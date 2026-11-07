#!/usr/bin/env node
// Build step for thegovlab.org (Netlify runs `node scripts/prerender.mjs`, see netlify.toml).
//
// The project pages and the Paul Light report are filled in the browser by Vue from Directus,
// so crawlers that do not run JavaScript (GPTBot, ClaudeBot, PerplexityBot, ...) only see the
// empty page frame. This script copies the site into dist/ and writes, for every published
// project, dist/project/<slug>.html with:
//   - the page text already in the HTML, rendered from the same Vue template the browser uses
//     (so the markup is the markup Vue produces; Vue then re-renders it with identical output),
//   - the Vue template moved into <script type="text/x-template"> and the page data into
//     <script type="application/json">, so the existing JavaScript renders from the same data,
//   - title, meta description, canonical, Open Graph / Twitter tags and schema.org JSON-LD.
// It also pre-renders /what-americans-want-from-government-reform/ and writes dist/sitemap.xml.
//
// Content changes in Directus only reach these pages after a rebuild (build hook + Directus flow).
// Projects that are not published are never written. Pages for new projects keep working before
// the next build through the /project/* rewrite in _redirects (the old client-side template).
//
// No dependencies: Node 24 (fetch, fs). Usage: node scripts/prerender.mjs [--out dist]

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const outArg = process.argv.indexOf('--out');
const OUT = path.resolve(ROOT, outArg > -1 ? process.argv[outArg + 1] : 'dist');
const SITE = 'https://thegovlab.org';
const SITE_NAME = 'The GovLab';
const API = 'https://burnes-center.directus.app';
const LICENSE = 'https://creativecommons.org/licenses/by-sa/4.0/';
const SITE_IMAGE = `${SITE}/static/img/thegovlab-og-2026.png`;
const ORG = { '@type': 'Organization', '@id': `${SITE}/#organization`, name: 'The Governance Lab', alternateName: 'The GovLab', url: `${SITE}/` };
const WEBSITE = { '@type': 'WebSite', '@id': `${SITE}/#website`, url: `${SITE}/`, name: 'The GovLab', publisher: { '@id': ORG['@id'] } };

// ---------------------------------------------------------------------------------------------
// Minimal renderer for the subset of Vue 2.0 templates these pages use. It follows Vue 2.0's
// template parser (whitespace handling, v-for before v-if, v-if/v-else pairing, empty comment
// for a false v-if, _s() for interpolation) so that its output equals the DOM Vue renders.
// Expressions are evaluated like Vue does: `with(scope)`, unknown names resolve to undefined.
// ---------------------------------------------------------------------------------------------
const makeSet = (s) => new Set(s.split(','));
const VOID_TAGS = makeSet('area,base,br,col,embed,frame,hr,img,input,isindex,keygen,link,meta,param,source,track,wbr');
const NON_PHRASING = makeSet('address,article,aside,base,blockquote,body,caption,col,colgroup,dd,details,dialog,div,dl,dt,fieldset,figcaption,figure,footer,form,h1,h2,h3,h4,h5,h6,head,header,hgroup,hr,html,legend,li,menuitem,meta,optgroup,option,param,rp,rt,source,style,summary,tbody,td,tfoot,th,thead,title,tr,track');
const CAN_BE_LEFT_OPEN = makeSet('colgroup,dd,dt,li,options,p,td,tfoot,th,thead,tr,source');
const BOOLEAN_ATTRS = makeSet('allowfullscreen,async,autofocus,autoplay,checked,compact,controls,declare,default,defaultchecked,defaultmuted,defaultselected,defer,disabled,enabled,formnovalidate,hidden,indeterminate,inert,ismap,itemscope,loop,multiple,muted,nohref,noresize,noshade,novalidate,nowrap,open,pauseonexit,readonly,required,reversed,scoped,seamless,selected,sortable,translate,truespeed,typemustmatch,visible');
const ALLOWED_GLOBALS = makeSet('Infinity,undefined,NaN,isFinite,isNaN,parseFloat,parseInt,decodeURI,decodeURIComponent,encodeURI,encodeURIComponent,Math,Number,Date,Array,Object,Boolean,String,RegExp,Map,Set,JSON,Intl,require');
const ATTR_RE = /^\s*([^\s"'<>\/=]+)(?:\s*(=)\s*(?:"([^"]*)"+|'([^']*)'+|([^\s"'=<>`]+)))?/;
const START_OPEN_RE = /^<([a-zA-Z_][\w\-.]*)/;
const START_CLOSE_RE = /^\s*(\/?)>/;
const END_TAG_RE = /^<\/([a-zA-Z_][\w\-.]*)[^>]*>/;

// Parses the element starting at html[0] and returns { root, length }.
function parseTemplate(html) {
  const stack = [];
  let root = null;
  let current = null;
  let i = 0;
  const closeTag = (tag) => {
    let pos = stack.length - 1;
    while (pos >= 0 && stack[pos].tag !== tag) pos--;
    if (pos < 0) {
      if (tag === 'br' || tag === 'p') openTag(tag, [], tag === 'br');
      if (tag === 'p') closeTag('p');
      return;
    }
    while (stack.length > pos) {
      const el = stack.pop();
      const last = el.children[el.children.length - 1];
      if (last && last.type === 3 && last.text === ' ') el.children.pop();
    }
    current = stack[stack.length - 1] || null;
  };
  const openTag = (tag, attrs, unary) => {
    const lastTag = current && current.tag;
    if (lastTag === 'p' && NON_PHRASING.has(tag)) closeTag('p');
    if (CAN_BE_LEFT_OPEN.has(tag) && current && current.tag === tag) closeTag(tag);
    const el = makeElement(tag, attrs);
    if (!root) root = el;
    else if (current) {
      if (el.else) {
        const prev = [...current.children].reverse().find((c) => c.type === 1);
        if (!prev || !prev.if) throw new Error(`v-else without v-if in <${tag}>`);
        prev.elseBlock = el;
      } else current.children.push(el);
    }
    if (!unary) { stack.push(el); current = el; }
  };
  const chars = (text) => {
    if (!current) return;
    text = text.trim() ? text : current.children.length ? ' ' : '';
    if (!text) return;
    if (text !== ' ' && text.includes('{{')) current.children.push({ type: 2, segments: parseText(text) });
    else current.children.push({ type: 3, text });
  };
  while (i < html.length) {
    const rest = html.slice(i);
    if (rest.startsWith('<!--')) {
      const end = rest.indexOf('-->');
      if (end < 0) throw new Error('Unclosed comment in template');
      i += end + 3;
      continue;
    }
    let m = rest.match(END_TAG_RE);
    if (m) {
      i += m[0].length;
      closeTag(m[1].toLowerCase());
      if (root && !stack.length) return { root, length: i };
      continue;
    }
    m = rest.match(START_OPEN_RE);
    if (m) {
      let pos = m[0].length;
      const attrs = [];
      let close;
      let am;
      while (!(close = rest.slice(pos).match(START_CLOSE_RE)) && (am = rest.slice(pos).match(ATTR_RE))) {
        pos += am[0].length;
        attrs.push([am[1], am[3] ?? am[4] ?? am[5] ?? '']);
      }
      if (close) {
        const tag = m[1].toLowerCase();
        i += pos + close[0].length;
        openTag(tag, attrs, VOID_TAGS.has(tag) || close[1] === '/');
        if (root && !stack.length) return { root, length: i };
        continue;
      }
    }
    // Text up to the next '<' that starts a tag or comment (a lone '<' stays text, as in Vue).
    let end = rest.indexOf('<', 1);
    while (end > -1 && !/^<(\/?[a-zA-Z_]|!--)/.test(rest.slice(end))) end = rest.indexOf('<', end + 1);
    if (end < 0) end = rest.length;
    chars(rest.slice(0, end));
    i += end;
  }
  throw new Error('Template root element is not closed');
}

function parseText(text) {
  const segments = [];
  const re = /\{\{((?:.|\n)+?)\}\}/g;
  let last = 0;
  let m;
  while ((m = re.exec(text))) {
    if (m.index > last) segments.push({ text: text.slice(last, m.index) });
    segments.push({ exp: m[1].trim() });
    last = re.lastIndex;
  }
  if (last < text.length) segments.push({ text: text.slice(last) });
  return segments;
}

function makeElement(tag, attrsList) {
  const el = { type: 1, tag, attrs: [], bound: [], children: [], staticClass: null, classBinding: null, staticStyle: null, styleBinding: null };
  for (const [name, value] of attrsList) {
    if (name === 'v-for') {
      const m = value.match(/(.*?)\s+(?:in|of)\s+(.*)/);
      if (!m) throw new Error(`Bad v-for: ${value}`);
      el.for = m[2].trim();
      const alias = m[1].trim();
      const it = alias.match(/\((\{[^}]*\}|[^,]*),([^,]*)(?:,([^,]*))?\)/);
      if (it) { el.alias = it[1].trim(); el.iterator1 = it[2].trim(); el.iterator2 = it[3] && it[3].trim(); } else el.alias = alias;
    } else if (name === 'v-if') el.if = value;
    else if (name === 'v-else') el.else = true;
    else if (name === 'v-html') el.html = value;
    else if (name === 'v-cloak' || name.startsWith('v-on:') || name.startsWith('@')) continue;
    else if (name === 'key' || name === 'ref' || name === ':key' || name === 'v-bind:key') continue;
    else if (name.startsWith(':') || name.startsWith('v-bind:')) {
      const attr = name.startsWith(':') ? name.slice(1) : name.slice(7);
      if (attr === 'class') el.classBinding = value;
      else if (attr === 'style') el.styleBinding = value;
      else el.bound.push([attr, value]);
    } else if (name.startsWith('v-')) throw new Error(`Unsupported directive ${name} in <${tag}>`);
    else if (name === 'class') el.staticClass = value;
    else if (name === 'style') el.staticStyle = value;
    else el.attrs.push([name, value]);
  }
  return el;
}

const fnCache = new Map();
const scopeHandler = {
  has: (target, key) => (typeof key !== 'string' ? key in target : key in target || !(ALLOWED_GLOBALS.has(key) || key[0] === '_')),
};
function evaluate(exp, scope) {
  let fn = fnCache.get(exp);
  if (!fn) {
    // eslint-disable-next-line no-new-func
    fn = new Function('__scope', `with (__scope) { return (${exp}); }`);
    fnCache.set(exp, fn);
  }
  return fn(new Proxy(scope, scopeHandler));
}

const toDisplayString = (val) => (val == null ? '' : typeof val === 'object' ? JSON.stringify(val, null, 2) : String(val));
const escapeText = (s) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
const escapeAttr = (s) => String(s).replace(/&/g, '&amp;').replace(/"/g, '&quot;');
const hyphenate = (s) => s.replace(/([a-z\d])([A-Z])/g, '$1-$2').toLowerCase();
// A static text part like "&nbsp" right before an interpolation needs its ';' once the value follows.
const closeEntity = (s) => s.replace(/(&[a-zA-Z][a-zA-Z0-9]*)$/, '$1;');

function renderList(val, fn) {
  const out = [];
  if (Array.isArray(val) || typeof val === 'string') for (let i = 0; i < val.length; i++) out.push(fn(val[i], i));
  else if (typeof val === 'number') for (let i = 0; i < val; i++) out.push(fn(i + 1, i));
  else if (val && typeof val === 'object') Object.keys(val).forEach((key, i) => out.push(fn(val[key], key, i)));
  return out.join('');
}

function stringifyClass(value) {
  if (!value) return '';
  if (typeof value === 'string') return value;
  if (Array.isArray(value)) return value.map(stringifyClass).filter(Boolean).join(' ');
  return Object.keys(value).filter((k) => value[k]).join(' ');
}

function renderNode(node, scope) {
  if (node.type === 3) return node.text;
  if (node.type === 2) {
    return node.segments
      .map((seg, idx) => {
        if (seg.exp) return escapeText(toDisplayString(evaluate(seg.exp, scope)));
        return node.segments[idx + 1] && node.segments[idx + 1].exp ? closeEntity(seg.text) : seg.text;
      })
      .join('');
  }
  if (node.for !== undefined) {
    return renderList(evaluate(node.for, scope), (item, key, index) => {
      const child = Object.create(scope);
      child[node.alias] = item;
      if (node.iterator1) child[node.iterator1] = key;
      if (node.iterator2) child[node.iterator2] = index;
      return renderIf(node, child);
    });
  }
  return renderIf(node, scope);
}

function renderIf(el, scope) {
  if (el.if === undefined) return renderElement(el, scope);
  if (evaluate(el.if, scope)) return renderElement(el, scope);
  return el.elseBlock ? renderNode(el.elseBlock, scope) : '<!---->';
}

function renderElement(el, scope) {
  if (el.tag === 'template') return el.children.map((c) => renderNode(c, scope)).join('');
  const attrs = new Map();
  for (const [name, value] of el.attrs) if (!attrs.has(name)) attrs.set(name, BOOLEAN_ATTRS.has(name) ? name : value);
  for (const [name, exp] of el.bound) {
    const value = evaluate(exp, scope);
    if (value == null || value === false) attrs.delete(name);
    else attrs.set(name, BOOLEAN_ATTRS.has(name) ? name : String(value));
  }
  const dynClass = el.classBinding ? stringifyClass(evaluate(el.classBinding, scope)) : '';
  const cls = el.staticClass ? (dynClass ? `${el.staticClass} ${dynClass}` : el.staticClass) : dynClass;
  let html = `<${el.tag}`;
  if (cls) html += ` class="${escapeAttr(cls)}"`;
  const styles = [];
  if (el.staticStyle) styles.push(el.staticStyle);
  if (el.styleBinding) {
    const st = evaluate(el.styleBinding, scope) || {};
    for (const [k, v] of Object.entries(st)) if (v != null && v !== '') styles.push(`${hyphenate(k)}: ${v}`);
  }
  if (styles.length) html += ` style="${escapeAttr(styles.join('; '))}"`;
  for (const [name, value] of attrs) html += ` ${name}="${escapeAttr(value)}"`;
  html += '>';
  if (VOID_TAGS.has(el.tag)) return html;
  const inner = el.html !== undefined ? toDisplayString(evaluate(el.html, scope)) : el.children.map((c) => renderNode(c, scope)).join('');
  return `${html}${inner}</${el.tag}>`;
}

// Replaces the element with id=rootId in `page` by its pre-rendered markup, followed by the
// original template (for Vue) and the page data (for the page's own script).
function prerenderRoot(page, { rootId, templateId, dataId, scope, data }) {
  const idx = page.search(new RegExp(`<[a-zA-Z]+[^>]*\\sid="${rootId}"`));
  if (idx < 0) throw new Error(`#${rootId} not found`);
  const { root, length } = parseTemplate(page.slice(idx));
  const source = page.slice(idx, idx + length);
  if (/<\/script/i.test(source)) throw new Error(`#${rootId} template contains </script>`);
  const rendered = renderNode(root, scope);
  const block = [
    rendered,
    `<script type="text/x-template" id="${templateId}">${source}</script>`,
    `<script type="application/json" id="${dataId}">${safeJson(data)}</script>`,
  ].join('\n');
  return page.slice(0, idx) + block + page.slice(idx + length);
}

// ---------------------------------------------------------------------------------------------
// Head tags and helpers
// ---------------------------------------------------------------------------------------------
const safeJson = (value) => JSON.stringify(value).replace(/</g, '\\u003c');

const ENTITIES = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ', rsquo: '’', lsquo: '‘', rdquo: '”', ldquo: '“', ndash: '–', mdash: '—', hellip: '…', eacute: 'é', aacute: 'á', iacute: 'í', oacute: 'ó', uacute: 'ú', ntilde: 'ñ', ccedil: 'ç', uuml: 'ü', ouml: 'ö', auml: 'ä' };
function plainText(html) {
  return String(html || '')
    .replace(/<(script|style)[^>]*>[\s\S]*?<\/\1>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&#x([0-9a-f]+);?/gi, (_, h) => String.fromCodePoint(parseInt(h, 16)))
    .replace(/&#(\d+);?/g, (_, d) => String.fromCodePoint(Number(d)))
    .replace(/&([a-z]+);?/gi, (m, n) => ENTITIES[n.toLowerCase()] ?? m)
    .replace(/\s+/g, ' ')
    .trim();
}
function truncate(text, max = 300) {
  if (text.length <= max) return text;
  const cut = text.slice(0, max - 1);
  return `${cut.slice(0, cut.lastIndexOf(' ') > 0 ? cut.lastIndexOf(' ') : cut.length).replace(/[\s,;:.]+$/, '')}…`;
}

// ---------------------------------------------------------------------------------------------
// Markdown copies (for the GovLab Open Corpus, llms.txt and llms-full.txt)
// ---------------------------------------------------------------------------------------------
const decodeEntities = (s) =>
  s
    .replace(/&#x([0-9a-f]+);?/gi, (_, h) => String.fromCodePoint(parseInt(h, 16)))
    .replace(/&#(\d+);?/g, (_, d) => String.fromCodePoint(Number(d)))
    .replace(/&([a-z]+);?/gi, (m, n) => (n.toLowerCase() === 'nbsp' ? ' ' : ENTITIES[n.toLowerCase()] ?? m));

const MD_BLOCK = makeSet('address,article,aside,blockquote,dd,div,dl,dt,figcaption,figure,footer,h1,h2,h3,h4,h5,h6,header,hr,li,main,nav,ol,p,pre,section,table,tbody,td,tfoot,th,thead,tr,ul');

// Lenient HTML -> tree, enough for CMS rich text.
function parseHtml(html) {
  const root = { tag: '#root', attrs: {}, children: [] };
  const stack = [root];
  const top = () => stack[stack.length - 1];
  const closeTo = (tags, stopAt) => {
    for (let i = stack.length - 1; i > 0; i--) {
      if (stopAt.includes(stack[i].tag)) return;
      if (tags.includes(stack[i].tag)) { stack.length = i; return; }
    }
  };
  const re = /<!--[\s\S]*?-->|<![^>]*>|<\/([a-zA-Z][\w:-]*)\s*>|<([a-zA-Z][\w:-]*)((?:\s+[^\s"'>\/=]+(?:\s*=\s*(?:"[^"]*"|'[^']*'|[^\s"'=<>`]+))?)*)\s*(\/?)>|[^<]+|</g;
  let m;
  while ((m = re.exec(html))) {
    const [tok, endTag, startTag, attrStr = '', selfClose] = m;
    if (tok.startsWith('<!')) continue;
    if (endTag) {
      const t = endTag.toLowerCase();
      const i = stack.map((n) => n.tag).lastIndexOf(t);
      if (i > 0) stack.length = i;
      continue;
    }
    if (startTag) {
      const t = startTag.toLowerCase();
      if (t === 'script' || t === 'style') {
        const close = html.toLowerCase().indexOf(`</${t}`, re.lastIndex);
        re.lastIndex = close < 0 ? html.length : html.indexOf('>', close) + 1;
        continue;
      }
      if (MD_BLOCK.has(t) && top().tag === 'p') stack.pop();
      if (t === 'li') closeTo(['li'], ['ul', 'ol']);
      if (t === 'tr') closeTo(['tr'], ['table']);
      if (t === 'td' || t === 'th') closeTo(['td', 'th'], ['tr', 'table']);
      const attrs = {};
      for (const a of attrStr.matchAll(/([^\s"'>\/=]+)(?:\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s"'=<>`]+)))?/g)) attrs[a[1].toLowerCase()] = decodeEntities(a[2] ?? a[3] ?? a[4] ?? '');
      const node = { tag: t, attrs, children: [] };
      top().children.push(node);
      if (!VOID_TAGS.has(t) && !selfClose) stack.push(node);
      continue;
    }
    top().children.push({ text: decodeEntities(tok) });
  }
  return root;
}

const tidy = (s) =>
  s
    .replace(/[ \t]+/g, ' ')
    .replace(/ *\n */g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
const oneLine = (s) => s.replace(/\s*\n\s*/g, ' ').replace(/\s+/g, ' ').trim();
const wrap = (s, mark) => {
  if (!s.trim()) return s;
  const lead = s.match(/^\s*/)[0];
  const trail = s.match(/\s*$/)[0];
  return `${lead}${mark}${s.trim()}${mark}${trail}`;
};
const mdLink = (text, href) => `[${oneLine(text).replace(/([[\]])/g, '\\$1')}](${href.trim().replace(/\s/g, '%20').replace(/\(/g, '%28').replace(/\)/g, '%29')})`;

function toMd(node, depth = 0) {
  if (node.text !== undefined) return node.text.replace(/\s+/g, ' ');
  const inner = () => node.children.map((c) => toMd(c, depth)).join('');
  const t = node.tag;
  if (/^h[1-6]$/.test(t)) {
    const text = oneLine(inner());
    return text ? `\n\n${'#'.repeat(Math.min(6, Math.max(3, Number(t[1]) + 1)))} ${text.replace(/^\*\*(.*)\*\*$/, '$1')}\n\n` : '';
  }
  switch (t) {
    case 'br':
      return '\n';
    case 'hr':
      return '\n\n---\n\n';
    case 'strong':
    case 'b':
      return wrap(inner(), '**');
    case 'em':
    case 'i':
      return wrap(inner(), '*');
    case 'code':
      return wrap(inner(), '`');
    case 'a': {
      const text = inner();
      const href = node.attrs.href || '';
      if (/^mailto:/i.test(href)) return /@/.test(text) ? '' : text;
      return /^https?:\/\//i.test(href) && text.trim() ? mdLink(text, href) : text;
    }
    case 'img':
      return /^https?:\/\//i.test(node.attrs.src || '') ? `![${oneLine(node.attrs.alt || '')}](${node.attrs.src.trim()})` : '';
    case 'ul':
    case 'ol': {
      const items = node.children.filter((c) => c.tag === 'li');
      const lines = items.map((li, i) => {
        const prefix = t === 'ol' ? `${i + 1}. ` : '- ';
        const body = tidy(toMd(li, depth + 1)).replace(/\n+/g, '\n');
        return prefix + body.split('\n').map((l, j) => (j ? ' '.repeat(prefix.length) + l : l)).join('\n');
      });
      return `\n\n${lines.join('\n')}\n\n`;
    }
    case 'blockquote':
      return `\n\n${tidy(inner()).split('\n').map((l) => `> ${l}`).join('\n')}\n\n`;
    case 'table':
      return `\n\n${mdTable(node)}\n\n`;
    case 'pre':
      return `\n\n\`\`\`\n${textOf(node)}\n\`\`\`\n\n`;
    default:
      return MD_BLOCK.has(t) ? `\n\n${inner()}\n\n` : inner();
  }
}

const textOf = (node) => (node.text !== undefined ? node.text : node.children.map(textOf).join(''));

function mdTable(table) {
  const rows = [];
  const walk = (n) => {
    for (const c of n.children || []) {
      if (c.tag === 'tr') rows.push(c.children.filter((x) => x.tag === 'td' || x.tag === 'th').map((cell) => oneLine(tidy(toMd(cell))).replace(/\|/g, '\\|')));
      else if (c.tag && c.tag !== 'table') walk(c);
    }
  };
  walk(table);
  if (!rows.length) return '';
  const width = Math.max(...rows.map((r) => r.length));
  const line = (r) => `| ${Array.from({ length: width }, (_, i) => r[i] || '').join(' | ')} |`;
  return [line(rows[0]), line(Array(width).fill('---')), ...rows.slice(1).map(line)].join('\n');
}

// Contact details are left out of the copies: e-mail addresses and phone numbers.
const scrubContacts = (md) =>
  md
    .replace(/(^|[^\w/@.+-])[\w.+-]+@[\w-]+(?:\.[\w-]+)+/g, '$1')
    .replace(/(^|[^\w])(?:\+\d{1,3}[\s.-]?)?\(?\d{3}\)?[\s.-]\d{3}[\s.-]\d{4}(?!\d)/g, '$1');

const htmlToMarkdown = (html) => scrubContacts(tidy(toMd(parseHtml(String(html || '')))));

function frontMatter(fields) {
  const lines = Object.entries(fields)
    .filter(([, v]) => v !== undefined && v !== null && !(Array.isArray(v) && !v.length) && v !== '')
    .map(([k, v]) => `${k}: ${JSON.stringify(v)}`);
  return `---\n${lines.join('\n')}\n---\n`;
}

function markdownDoc(fields, title, body) {
  return `${frontMatter(fields)}\n# ${title}\n\n${scrubContacts(tidy(body))}\n`;
}

function headTags({ title, description, canonical, markdown, image, imageAlt, type = 'website', jsonld }) {
  const lines = [
    `<title>${escapeText(title)}</title>`,
    `<meta name="description" content="${escapeAttr(description)}">`,
    `<link rel="canonical" href="${escapeAttr(canonical)}">`,
    `<link rel="alternate" type="text/markdown" href="${escapeAttr(markdown)}">`,
    `<meta property="og:type" content="${type}">`,
    `<meta property="og:site_name" content="${escapeAttr(SITE_NAME)}">`,
    `<meta property="og:url" content="${escapeAttr(canonical)}">`,
    `<meta property="og:title" content="${escapeAttr(title)}">`,
    `<meta property="og:description" content="${escapeAttr(description)}">`,
    `<meta property="og:image" content="${escapeAttr(image)}">`,
    `<meta property="og:image:alt" content="${escapeAttr(imageAlt)}">`,
    `<meta name="twitter:card" content="summary_large_image">`,
    `<meta name="twitter:title" content="${escapeAttr(title)}">`,
    `<meta name="twitter:description" content="${escapeAttr(description)}">`,
    `<meta name="twitter:image" content="${escapeAttr(image)}">`,
    `<script type="application/ld+json">${safeJson(jsonld)}</script>`,
  ];
  return lines.join('\n    ');
}

// Removes the page's own title/description/canonical/og/twitter tags and puts `tags` where the
// <title> was.
function replaceHead(page, tags) {
  const headEnd = page.search(/<\/head>/i);
  if (headEnd < 0) throw new Error('No </head>');
  let head = page.slice(0, headEnd);
  const titleAt = head.search(/<title>/i);
  if (titleAt < 0) throw new Error('No <title>');
  head = head.slice(0, titleAt) + '\u0000' + head.slice(titleAt).replace(/<title>[\s\S]*?<\/title>/i, '');
  head = head.replace(/[ \t]*<meta\b[^>]*>[ \t]*\r?\n?/gi, (tag) =>
    /\b(property|name)=["'](og:|twitter:|description["'])/i.test(tag) ? '' : tag,
  );
  head = head.replace(/[ \t]*<link\b[^>]*rel=["']canonical["'][^>]*>[ \t]*\r?\n?/gi, '');
  return head.replace('\u0000', tags) + page.slice(headEnd);
}

async function getJson(url) {
  const res = await fetch(url, { headers: { Accept: 'application/json' } });
  if (!res.ok) throw new Error(`GET ${url} -> ${res.status}`);
  const body = await res.json();
  if (!body || !('data' in body)) throw new Error(`GET ${url} -> no data`);
  return body.data;
}

function writeOut(rel, content) {
  const file = path.join(OUT, rel);
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.rmSync(file, { force: true });
  fs.writeFileSync(file, content);
}

// Copies the site into OUT the way Netlify published the repo root before: everything except
// dot-files, node_modules and the output folder itself.
function copySite(src, dst) {
  fs.mkdirSync(dst, { recursive: true });
  for (const entry of fs.readdirSync(src, { withFileTypes: true })) {
    if (entry.name.startsWith('.') || entry.name === 'node_modules') continue;
    const from = path.join(src, entry.name);
    const to = path.join(dst, entry.name);
    if (path.resolve(from) === OUT) continue;
    if (entry.isDirectory()) copySite(from, to);
    else if (entry.isFile()) fs.copyFileSync(from, to, fs.constants.COPYFILE_FICLONE);
  }
}

// ---------------------------------------------------------------------------------------------
// Project pages
// ---------------------------------------------------------------------------------------------
const PROJECT_FIELDS = ['*.*', 'picture.*', 'project_team.team_id.*', 'gallery.*', 'project_team.team_id.picture.*'];
const API_URL = 'https://burnes-center.directus.app/'; // apiURL in static/js/project_specific.js
const PIC_URL_2020 = 'https://thegovlab-files.nyc3.cdn.digitaloceanspaces.com/thegovlab-directus/uploads/thegovlab/originals/';

// Same order as static/js/project_specific.js (Stefaan Verhulst and Beth Noveck move first).
const sortTeam = (team) => team.sort((a, b) => (b.team_id && b.team_id.slug && (b.team_id.slug == 'stefaan-verhulst' || b.team_id.slug == 'beth-simone-noveck') ? 1 : -1));

// Only the fields the template reads, so the inline JSON stays small.
function projectData(p) {
  const pick = (o, keys) => Object.fromEntries(keys.filter((k) => k in o).map((k) => [k, o[k]]));
  const data = pick(p, ['slug', 'name', 'description', 'project_link', 'description_full', 'results', 'more_about', 'background', 'location', 'partners', 'gallery_2020']);
  data.gallery = (p.gallery || []).map((g) => ({ directus_files_id: g.directus_files_id }));
  data.project_team = sortTeam([...(p.project_team || [])]).map((m) => ({
    team_id: m.team_id && {
      ...pick(m.team_id, ['slug', 'name', 'status', 'picture_blog2020']),
      picture: m.team_id.picture ? { id: m.team_id.picture.id } : m.team_id.picture,
    },
  }));
  return data;
}

const asList = (v) => (Array.isArray(v) ? v : v && typeof v === 'object' ? Object.values(v) : []);
const visibleTeam = (data) => data.project_team.filter((m) => m.team_id && m.team_id.status && m.team_id.status != 'deleted');

function projectJsonLd(p, data, canonical, image, description) {
  const keywords = [...asList(p.innovative_capability), ...asList(p.governance_area), ...asList(p.product_category)].filter((k) => typeof k === 'string' && k.trim());
  const project = {
    '@type': 'ResearchProject',
    '@id': `${canonical}#project`,
    name: p.name,
    description,
    url: canonical,
    image,
    parentOrganization: { '@id': ORG['@id'] },
    member: visibleTeam(data).map((m) => ({ '@type': 'Person', name: m.team_id.name, url: `${SITE}/team.html#${m.team_id.slug}` })),
  };
  if (/^https?:\/\//.test(p.project_link || '') && !p.project_link.startsWith(SITE)) project.sameAs = p.project_link;
  const places = asList(p.location).map((l) => l && l.loc).filter(Boolean);
  if (places.length) project.location = places.map((name) => ({ '@type': 'Place', name }));
  if (keywords.length) project.keywords = [...new Set(keywords)].join(', ');
  const partners = asList(p.partners).map((x) => x && x.partner).filter(Boolean);
  const page = {
    '@type': 'WebPage',
    '@id': `${canonical}#webpage`,
    url: canonical,
    name: `The GovLab | ${p.name}`,
    description,
    inLanguage: 'en',
    license: LICENSE,
    isPartOf: { '@id': WEBSITE['@id'] },
    about: { '@id': project['@id'] },
    primaryImageOfPage: { '@type': 'ImageObject', url: image },
    breadcrumb: { '@id': `${canonical}#breadcrumb` },
  };
  if (partners.length) page.mentions = partners.map((name) => ({ '@type': 'Organization', name }));
  const breadcrumb = {
    '@type': 'BreadcrumbList',
    '@id': `${canonical}#breadcrumb`,
    itemListElement: [
      { '@type': 'ListItem', position: 1, name: 'Projects', item: `${SITE}/projects` },
      { '@type': 'ListItem', position: 2, name: p.name, item: canonical },
    ],
  };
  return { '@context': 'https://schema.org', '@graph': [page, project, breadcrumb, WEBSITE, ORG] };
}

const FOOTER_LICENCE = 'Creative Commons Attribution-ShareAlike 4.0 International (https://creativecommons.org/licenses/by-sa/4.0/)';
const SOURCE = 'The GovLab (thegovlab.org)';

function projectMarkdown(p, data, canonical, summary) {
  const team = visibleTeam(data).map((m) => m.team_id);
  const parts = [];
  if (plainText(p.description)) parts.push(plainText(p.description));
  if (/^https?:\/\//.test(p.project_link || '')) parts.push(`Project website: ${mdLink(p.project_link, p.project_link)}`);
  const section = (heading, html) => {
    const md = htmlToMarkdown(html);
    if (md) parts.push(`## ${heading}\n\n${md}`);
  };
  section('Background', p.background);
  section('Description', p.description_full);
  if (p.results && p.results != 'NULL') section('Results and impact', p.results);
  const list = (heading, items) => items.length && parts.push(`## ${heading}\n\n${items.map((x) => `- ${x}`).join('\n')}`);
  list('Location', asList(p.location).map((l) => l && l.loc).filter(Boolean).map((x) => oneLine(String(x))));
  list('Partners', asList(p.partners).map((x) => x && x.partner).filter(Boolean).map((x) => oneLine(String(x))));
  list('Team', team.map((m) => mdLink(m.name, `${SITE}/team.html#${m.slug}`)));
  list('Additional resources', asList(p.more_about).filter((x) => x && x.title && /^https?:\/\//.test(x.link || '')).map((x) => mdLink(x.title, x.link)));
  return markdownDoc(
    {
      id: `govlab:project/${p.slug}`,
      type: 'GovLab project',
      title: p.name,
      url: canonical,
      authors: team.map((m) => m.name),
      summary,
      source: SOURCE,
      licence: FOOTER_LICENCE,
    },
    p.name,
    parts.join('\n\n'),
  );
}

function renderProject(shell, p) {
  const data = projectData(p);
  const canonical = `${SITE}/project/${p.slug}`;
  const markdown = `${canonical}.md`;
  const image = p.picture && p.picture.id ? `${API}/assets/${p.picture.id}` : p.main_picture_2020 || SITE_IMAGE;
  const description = truncate(plainText(p.description) || plainText(p.background) || `${p.name}, a project of The GovLab.`);
  const scope = { projectData: data, apiURL: API_URL, picURL2020: PIC_URL_2020, items: [], progess: '', meta_title: '', meta_image: '', meta_content: '', projectslug: p.slug };
  let page = prerenderRoot(shell, { rootId: 'projectpage', templateId: 'project-tpl', dataId: 'project-data', scope, data });
  page = replaceHead(page, headTags({
    title: `The GovLab | ${p.name}`,
    description,
    canonical,
    markdown,
    image,
    imageAlt: p.name,
    jsonld: projectJsonLd(p, data, canonical, image, plainText(p.description) || description),
  }));
  return {
    html: page,
    doc: { file: `project/${p.slug}.md`, url: canonical, markdown, title: p.name, summary: truncate(description, 200), text: projectMarkdown(p, data, canonical, description) },
  };
}

// ---------------------------------------------------------------------------------------------
// Paul Light report (what-americans-want-from-government-reform/)
// ---------------------------------------------------------------------------------------------
async function renderReport() {
  const rel = 'what-americans-want-from-government-reform/index.html';
  const shell = fs.readFileSync(path.join(ROOT, rel), 'utf8');
  // paul_light_report is a singleton collection: the API returns one object, not a list.
  const asArray = (d) => (Array.isArray(d) ? d : d ? [d] : []);
  const report = asArray(await getJson(`${API}/items/paul_light_report?fields=*.*`)).find((r) => r.status === 'published');
  const author = asArray(await getJson(`${API}/items/team?fields=*.*&filter[slug][_eq]=paul-light`))[0];
  if (!report || !author) {
    console.warn('report: no published report or author, page left as it is');
    return null;
  }
  const data = {
    reportData: [{ title: report.title, report_sections: report.report_sections, end_notes: report.end_notes }],
    authorData: [{ picture: author.picture ? { filename_disk: author.picture.filename_disk } : author.picture }],
  };
  const canonical = `${SITE}/what-americans-want-from-government-reform/`;
  const markdown = `${SITE}/what-americans-want-from-government-reform.md`;
  const description = truncate(plainText(report.abstract) || plainText(report.report_sections));
  const authorName = author.name || 'Paul C. Light';
  const scope = { ...data, meta_title: '', meta_content: '' };
  let page = prerenderRoot(shell, { rootId: 'reportpage', templateId: 'report-tpl', dataId: 'report-data', scope, data });
  const jsonld = {
    '@context': 'https://schema.org',
    '@graph': [
      { '@type': 'WebPage', '@id': `${canonical}#webpage`, url: canonical, name: report.title, description, inLanguage: 'en', isPartOf: { '@id': WEBSITE['@id'] }, mainEntity: { '@id': `${canonical}#report` } },
      {
        '@type': 'Report',
        '@id': `${canonical}#report`,
        headline: report.title,
        name: report.title,
        description,
        url: canonical,
        inLanguage: 'en',
        dateModified: report.modified_on || undefined,
        author: { '@type': 'Person', name: authorName, jobTitle: author.title || undefined, url: `${SITE}/team.html#paul-light` },
        publisher: { '@id': ORG['@id'] },
        image: SITE_IMAGE,
      },
      WEBSITE,
      ORG,
    ],
  };
  page = replaceHead(page, headTags({ title: `The GovLab | ${report.title}`, description, canonical, markdown, image: SITE_IMAGE, imageAlt: 'The GovLab', type: 'article', jsonld }));
  writeOut(rel, page);
  // The report page's own footer states no licence (unlike the project pages).
  const body = [
    `By ${authorName}${author.title ? `, ${oneLine(author.title)}` : ''}`,
    htmlToMarkdown(report.abstract),
    htmlToMarkdown(report.report_sections),
    `## Endnotes\n\n${htmlToMarkdown(report.end_notes)}`,
  ].filter((x) => x && x.trim()).join('\n\n');
  const text = markdownDoc(
    { id: 'govlab:report/what-americans-want-from-government-reform', type: 'GovLab report', title: report.title, url: canonical, authors: [authorName], summary: description, source: SOURCE, licence: 'none stated' },
    report.title,
    body,
  );
  return {
    sitemap: { loc: canonical, lastmod: report.modified_on },
    doc: { file: 'what-americans-want-from-government-reform.md', url: canonical, markdown, title: report.title, summary: truncate(description, 200), text },
  };
}

// ---------------------------------------------------------------------------------------------
// Sitemap, llms.txt, llms-full.txt, _headers
// ---------------------------------------------------------------------------------------------
const STATIC_PAGES = ['/', '/about', '/projects', '/publications', '/team', '/global-advisory-council', '/our-transparency', '/job-board', '/contact', '/people-led-innovation', '/open-data-demand', '/smarterstate'];

function sitemap(entries) {
  const xmlEscape = (s) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;');
  const urls = entries.map((e) => `  <url><loc>${xmlEscape(e.loc)}</loc>${e.lastmod ? `<lastmod>${e.lastmod.slice(0, 10)}</lastmod>` : ''}</url>`);
  return `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls.join('\n')}\n</urlset>\n`;
}

const LLMS_INTRO = '> The Governance Lab (The GovLab) works on deepening our understanding of how to govern more effectively and legitimately through technology. Its website, thegovlab.org, presents the GovLab\'s projects, publications, team and events.';

function llmsTxt(docs) {
  const items = docs.map((d) => `- [${d.title.replace(/([[\]])/g, '\\$1')}](${d.markdown}): ${oneLine(d.summary)}`);
  return `# The GovLab\n\n${LLMS_INTRO}\n\n## Project pages (Markdown copies of the GovLab project pages and one report only, not the whole site)\n\n${items.join('\n')}\n`;
}

function llmsFullTxt(docs) {
  return `# The GovLab\n\n${LLMS_INTRO}\n\nThe full text of every page listed in https://thegovlab.org/llms.txt follows, one Markdown document per page.\n\n${docs.map((d) => d.text).join('\n')}`;
}

function headersFile(docs) {
  const existing = fs.existsSync(path.join(ROOT, '_headers')) ? `${fs.readFileSync(path.join(ROOT, '_headers'), 'utf8').trimEnd()}\n\n` : '';
  const block = (p, lines) => `${p}\n${lines.map((l) => `  ${l}`).join('\n')}`;
  return `${existing}${[
    block('/llms.txt', ['Content-Type: text/plain; charset=utf-8']),
    block('/llms-full.txt', ['Content-Type: text/markdown; charset=utf-8']),
    ...docs.map((d) => block(`/${d.file}`, ['Content-Type: text/markdown; charset=utf-8', `Link: <${d.url}>; rel="canonical"`])),
  ].join('\n\n')}\n`;
}

// ---------------------------------------------------------------------------------------------
async function main() {
  const started = Date.now();
  fs.rmSync(OUT, { recursive: true, force: true });
  copySite(ROOT, OUT);

  const shell = fs.readFileSync(path.join(ROOT, 'project/index.html'), 'utf8');
  const fields = PROJECT_FIELDS.join(',');
  const projects = await getJson(`${API}/items/projects?filter[status][_eq]=published&limit=-1&fields=${encodeURIComponent(fields)}`);
  if (!Array.isArray(projects) || projects.length === 0) throw new Error('No published projects returned; refusing to build');

  const entries = STATIC_PAGES.map((p) => ({ loc: `${SITE}${p}` }));
  const docs = [];
  for (const p of [...projects].sort((a, b) => String(a.name).localeCompare(String(b.name)))) {
    if (p.status !== 'published') continue; // never write drafts, even if the API filter changes
    if (!/^[a-z0-9][a-z0-9-]*$/.test(p.slug || '') || p.slug === 'index') {
      console.warn(`project ${p.id}: unusable slug ${JSON.stringify(p.slug)}, skipped`);
      continue;
    }
    try {
      const { html, doc } = renderProject(shell, p);
      writeOut(`project/${p.slug}.html`, html);
      writeOut(doc.file, doc.text);
      entries.push({ loc: doc.url });
      docs.push(doc);
    } catch (err) {
      // The page then keeps working through the client-side template, as before.
      console.warn(`project ${p.slug}: not pre-rendered (${err.message})`);
    }
  }
  const projectCount = docs.length;

  try {
    const report = await renderReport();
    if (report) {
      entries.push(report.sitemap);
      writeOut(report.doc.file, report.doc.text);
      docs.push(report.doc);
    }
  } catch (err) {
    console.warn(`report: not pre-rendered (${err.message})`);
  }

  writeOut('sitemap.xml', sitemap(entries));
  writeOut('llms.txt', llmsTxt(docs));
  writeOut('llms-full.txt', llmsFullTxt(docs));
  writeOut('_headers', headersFile(docs));
  console.log(`prerender: ${projectCount}/${projects.length} project pages, ${docs.length - projectCount} report, ${docs.length} Markdown copies, ${entries.length} sitemap URLs, ${((Date.now() - started) / 1000).toFixed(1)}s -> ${path.relative(ROOT, OUT) || '.'}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
