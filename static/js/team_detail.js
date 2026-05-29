////////////////////////////////////////
// reload page after Forward and back
///////////////////////////////////////

const TYPE_BACK_FORWARD = 2;

function isReloadedPage() {
  return performance.navigation.type === TYPE_BACK_FORWARD;
}

function main() {
  if (isReloadedPage()) {
    window.location.reload();
  }
}
main();

////////////////////////////////////////////////////////////
///// TEAM  API REQUEST ` `
////////////////////////////////////////////////////////////


Vue.use(VueMeta);
new Vue({

  el: '#teamdetail',

  data () {
    return {
      memberData: [],
      client:[],
      more_body: false,
      news_toggle:false,
      awards_toggle:false,
      publications_toggle:false,
      projects_toggle:false,
      events_toggle:false,
      meta_title:'',
      meta_content:'',
      meta_image: '',
      twitter_title:'',
      twitter_image:'',
      twitter_desc:'',
      apiURL: 'https://burnes-center.directus.app/items/team?filter[slug][like]=',
      apiApp: '&fields=*.*,books.books_id.*,videos.directus_files_id.*,projects.projects_id.*',
      combinedPublications: '',
      otherWorks: '',
      rebootTeamId: null,
      pawTeamId: null,
      other_works_toggle: false

    }
  },
metaInfo () {
     return {
       title: this.meta_title,
       meta: [

      {name: 'twitter:card', content: 'summary_large_image'},
       {name: 'twitter:title', content: this.meta_title},
       {name: 'twitter:description', content: this.meta_content},
       {name: 'twitter:image', content: this.meta_image},
       {property: 'og:title', content: this.meta_title},
       {property: 'og:site_name', content: this.meta_title},
       {property: 'og:type', content: 'website'},
       {property: 'og:image', content:  this.meta_image},
       {property: 'og:description', content:  this.meta_content},
       { itemprop:'name', content: this.meta_title},
       { itemprop:'image', content: this.meta_image},
       { itemprop:'description', content: this.meta_content}
 ]
 }
},
  created: function created() {
    this.memberslug=window.location.pathname.split('/');
    this.memberslug = this.memberslug[this.memberslug.length - 1].split('.')[0];

    this.fetchTeamDetail();
  },

  methods: {

    fetchTeamDetail() {
      self = this;
      this.client = new DirectusSDK({
        url: "https://burnes-center.directus.app/",
        project: "/",
        storage: window.localStorage
      });

      this.client.getItems(
  'team',
  {
    limit: -1,
    filter: {
      slug: self.memberslug
    },
    fields: ['*.*','books.books_id.*','videos.directus_files_id.*','books.books_id.picture.*','projects.projects_id.*','bio_events.events_id.*','bio_courses.courses_id.*',],
    deep: {
      bio_events: {
        _limit: -1
      }
    }
  }
).then(data => {
  if (!data.data || !data.data[0]) {
    return;
  }
  if (data.data[0].books) {
    data.data[0].books.sort(function(a, b) {
      var textA = a.books_id.title.toUpperCase();
      var textB = b.books_id.title.toUpperCase();
      return (textA < textB) ? -1 : (textA > textB) ? 1 : 0;
    });
  }
  if (data.data[0].bio_events) {
    data.data[0].bio_events.sort(function(a, b) {
      var textA = moment(a.events_id.from).format('X');
      var textB = moment(b.events_id.from).format('X');
      if(textA == 'Invalid date')textA = '1357018200';
      if(textB == 'Invalid date')textB = '1357018200';
      return (textA < textB) ? -1 : (textA > textB) ? 1 : 0;
    });
    data.data[0].bio_events.reverse();
  }
  if (data.data[0].projects) {
    data.data[0].projects.sort(function(a, b) {
      var textA = moment(a.projects_id.created_on).format('X');
      var textB = moment(b.projects_id.created_on).format('X');
      if(textA == 'Invalid date') textA = '0';
      if(textB == 'Invalid date') textB = '0';
      return (textA < textB) ? -1 : (textA > textB) ? 1 : 0;
    });
    data.data[0].projects.reverse();

    var seenProjectIds = {};
    var seenProjectNames = {};
    data.data[0].projects = data.data[0].projects.filter(function(project) {
      if (!project.projects_id) {
        return false;
      }
      var projectId = project.projects_id.id;
      var projectName = (project.projects_id.name || '').trim().toLowerCase();
      if (seenProjectIds[projectId] || seenProjectNames[projectName]) {
        return false;
      }
      seenProjectIds[projectId] = true;
      seenProjectNames[projectName] = true;
      return true;
    });
  }

  self.memberData = data.data[0];
  self.meta_title = 'The Govlab '+self.memberData.name;
  self.meta_content = self.memberData.bio_short;
  self.meta_image = self.memberData.picture;

  self.fetchBlogsAndCombine();
  self.fetchOtherWorks();
})
.catch(error => console.error(error));
    },

    hasTeamPublicationsHtml() {
      const pubs = this.memberData.publications;
      return pubs && pubs !== 'NULL' && String(pubs).trim().length > 0;
    },

    parseNameParts(fullName) {
      const parts = (fullName || '').trim().split(/\s+/).filter(Boolean);
      if (parts.length < 2) {
        return { firstName: parts[0] || '', lastName: parts[0] || '' };
      }
      return {
        firstName: parts.slice(0, -1).join(' '),
        lastName: parts[parts.length - 1]
      };
    },

    resolvePawTeamId() {
      const self = this;
      const nameParts = this.parseNameParts(this.memberData.name);

      return this.client.getItems('paw_team', {
        limit: 1,
        fields: ['id', 'First_Name', 'Last_Name'],
        filter: {
          First_Name: { _eq: nameParts.firstName },
          Last_Name: { _eq: nameParts.lastName }
        }
      }).then(function (data) {
        self.pawTeamId = data.data && data.data[0] ? data.data[0].id : null;
        return self.pawTeamId;
      }).catch(function () {
        self.pawTeamId = null;
        return null;
      });
    },

    resolveRebootTeamId() {
      const self = this;
      const nameParts = this.parseNameParts(this.memberData.name);

      return this.client.getItems('Reboot_Democracy_team', {
        limit: 1,
        fields: ['id', 'First_Name', 'Last_Name'],
        filter: {
          First_Name: { _eq: nameParts.firstName },
          Last_Name: { _eq: nameParts.lastName }
        }
      }).then(function (data) {
        self.rebootTeamId = data.data && data.data[0] ? data.data[0].id : null;
        return self.rebootTeamId;
      }).catch(function () {
        self.rebootTeamId = null;
        return null;
      });
    },

    fetchPublicationsFromCollection() {
      const self = this;
      const memberName = (self.memberData.name || '').trim();
      if (!memberName) {
        return Promise.resolve([]);
      }

      return this.client.getItems('publications', {
        limit: -1,
        sort: '-pub_date',
        fields: ['id', 'title', 'authors', 'pub_date', 'url', 'status'],
        filter: {
          authors: { _icontains: memberName },
          status: { _eq: 'published' }
        }
      }).then(function (data) {
        return data.data || [];
      }).catch(function (error) {
        console.error('Error fetching publications collection:', error);
        return [];
      });
    },

    isExcludedPublication(text) {
      return (text || '').toLowerCase().indexOf('news that caught our eye') !== -1;
    },

    filterPublicationItems(items) {
      const self = this;
      return items.filter(function (item) {
        const tempDiv = document.createElement('div');
        tempDiv.innerHTML = item.html;
        const text = tempDiv.textContent || tempDiv.innerText || '';
        return !self.isExcludedPublication(text);
      });
    },

    publicationItemsFromHtml(publicationsHTML) {
      const self = this;
      const allItems = [];
      if (!publicationsHTML) {
        return allItems;
      }

      const tempDiv = document.createElement('div');
      tempDiv.innerHTML = publicationsHTML;
      const pubListItems = tempDiv.querySelectorAll('li');

      pubListItems.forEach(function (li) {
        const text = li.textContent || li.innerText || '';
        if (self.isExcludedPublication(text)) {
          return;
        }
        const html = li.outerHTML;
        let date = null;
        const dateMatch = text.match(/(\d{4})/);
        if (dateMatch) {
          const year = parseInt(dateMatch[1], 10);
          const fullDateMatch = text.match(/(\w+\s+\d{1,2},?\s+\d{4})/i) || text.match(/(\d{1,2}\/\d{1,2}\/\d{4})/);
          if (fullDateMatch) {
            date = moment(fullDateMatch[1]).toDate();
          } else {
            date = new Date(year, 0, 1);
          }
        }
        allItems.push({ html: html, date: date, type: 'publication' });
      });

      return allItems;
    },

    publicationItemsFromCollection(pubs) {
      const self = this;
      return pubs.filter(function (pub) {
        return !self.isExcludedPublication(pub.title);
      }).map(function (pub) {
        const title = pub.title || 'Untitled';
        const url = pub.url || '#';
        const authors = pub.authors ? ', ' + pub.authors : '';
        const formattedDate = pub.pub_date ? moment(pub.pub_date).format('MMMM D, YYYY') : '';
        const date = pub.pub_date ? new Date(pub.pub_date) : null;
        return {
          html: '<li><a href="' + url + '" target="_blank">' + title + '</a>' + authors + (formattedDate ? ', ' + formattedDate : '') + '</li>',
          date: date,
          type: 'publication'
        };
      });
    },

    getPawBlogTranslation(blog) {
      const translations = blog.translations || [];
      return translations.find(function (translation) {
        return translation.languages_code === 'en-US';
      }) || translations.find(function (translation) {
        return translation.slug;
      }) || translations[0] || {};
    },

    pawBlogItemsFromPosts(blogs) {
      const self = this;
      return blogs.map(function (blog) {
        const translation = self.getPawBlogTranslation(blog);
        const title = translation.title || 'Untitled';
        const slug = translation.slug;
        const blogLink = slug ? 'https://poweratwork.us/' + slug : '#';
        const blogSource = 'Power At Work';
        const blogDate = blog.publication_date;
        const formattedDate = blogDate ? moment(blogDate).format('MMMM D, YYYY') : '';
        const date = blogDate ? new Date(blogDate) : null;
        return {
          html: '<li><a href="' + blogLink + '" target="_blank">' + title + '</a>, ' + blogSource + (formattedDate ? ', ' + formattedDate : '') + '</li>',
          date: date,
          type: 'paw_blog'
        };
      });
    },

    blogItemsFromPosts(blogs) {
      const self = this;
      return blogs.filter(function (blog) {
        return !self.isExcludedPublication(blog.title);
      }).map(function (blog) {
        const blogTitle = blog.title || 'Untitled';
        const blogLink = blog.fullURL || blog.external_link || (blog.slug ? 'https://rebootdemocracy.ai/blog/' + blog.slug : '#');
        const blogSource = 'Reboot Democracy';
        const blogDate = blog.date || blog.date2;
        const formattedDate = blogDate ? moment(blogDate).format('MMMM D, YYYY') : '';
        const date = blogDate ? new Date(blogDate) : null;
        return {
          html: '<li><a href="' + blogLink + '" target="_blank">' + blogTitle + '</a>, ' + blogSource + (formattedDate ? ', ' + formattedDate : '') + '</li>',
          date: date,
          type: 'blog'
        };
      });
    },

    buildCombinedPublicationsHtml(allItems, fallbackHtml, sortByDate) {
      if (sortByDate !== false) {
        allItems.sort(function (a, b) {
          if (!a.date && !b.date) return 0;
          if (!a.date) return 1;
          if (!b.date) return -1;
          return new Date(b.date) - new Date(a.date);
        });
      }

      let combinedHTML = '';
      allItems.forEach(function (item) {
        combinedHTML += item.html;
      });

      if (combinedHTML && !combinedHTML.trim().startsWith('<ul')) {
        return '<ul>' + combinedHTML + '</ul>';
      }
      return combinedHTML || fallbackHtml || '';
    },

    buildListHtmlFromItems(items) {
      if (!items.length) {
        return '';
      }

      let listHtml = '';
      items.forEach(function (item) {
        listHtml += item.html;
      });
      return '<ul>' + listHtml + '</ul>';
    },

    buildOtherWorksHtml(publicationItems, pawItems) {
      let html = this.buildListHtmlFromItems(publicationItems);

      if (publicationItems.length && pawItems.length) {
        html += '<p class="e-other-works-heading"><strong>Power At Work</strong></p>';
      }

      html += this.buildListHtmlFromItems(pawItems);
      return html;
    },

    fetchOtherWorks() {
      const self = this;
      const publicationItems = self.hasTeamPublicationsHtml()
        ? self.filterPublicationItems(self.publicationItemsFromHtml(self.memberData.publications))
        : [];

      self.resolvePawTeamId().then(function (pawTeamId) {
        const pawPromise = pawTeamId
          ? self.client.getItems('paw_blog', {
              limit: -1,
              sort: '-publication_date',
              fields: ['id', 'status', 'publication_date', 'translations.title', 'translations.slug', 'translations.languages_code', 'author.paw_team_id'],
              filter: {
                status: { _eq: 'published' },
                author: { paw_team_id: { _eq: pawTeamId } }
              }
            })
          : Promise.resolve({ data: [] });

        return pawPromise.then(function (data) {
          const pawItems = self.pawBlogItemsFromPosts(data.data || []);
          self.otherWorks = self.buildOtherWorksHtml(publicationItems, pawItems);
        });
      }).catch(function (error) {
        console.error('Error fetching Power At Work blog posts:', error);
        self.otherWorks = self.buildOtherWorksHtml(publicationItems, []);
      });
    },

    fetchBlogsAndCombine() {
      const self = this;
      self.resolveRebootTeamId().then(function (rebootTeamId) {
        const blogPromise = self.client.getItems('reboot_democracy_blog', {
          limit: -1,
          sort: '-date',
          fields: ['*', 'authors.*'],
          filter: {
            status: { _eq: 'published' }
          }
        });

        const pubsPromise = self.fetchPublicationsFromCollection();

        return Promise.all([blogPromise, pubsPromise]).then(function (results) {
          const blogData = results[0];
          const collectionPubs = results[1];
          const allItems = [];

          allItems.push.apply(allItems, self.publicationItemsFromCollection(collectionPubs));

          const filteredBlogs = (blogData.data || []).filter(function (blog) {
            if (!blog.authors || !Array.isArray(blog.authors) || !rebootTeamId) {
              return false;
            }
            if ((blog.status || '').toLowerCase() !== 'published') {
              return false;
            }
            return blog.authors.some(function (author) {
              return author.team_id === rebootTeamId;
            });
          });

          allItems.push.apply(allItems, self.blogItemsFromPosts(filteredBlogs));

          const filteredItems = self.filterPublicationItems(allItems);
          self.combinedPublications = self.buildCombinedPublicationsHtml(filteredItems, '');
        });
      }).catch(function (error) {
        console.error('Error fetching publications and Reboot blog posts:', error);
        self.combinedPublications = '';
      });
    },

    assetUrl(file) {
      if (!file || file === 'NULL') {
        return null;
      }
      const id = typeof file === 'object' && file.id ? file.id : file;
      if (!id || !this.client || !this.client.url) {
        return null;
      }
      return this.client.url + 'assets/' + id;
    },

    highResPhotoUrl() {
      return this.assetUrl(this.memberData.high_resolution_photo);
    },

    hasHighResPhoto() {
      return !!this.highResPhotoUrl();
    },

    projectHref(project) {
      if (!project || !project.projects_id) {
        return '#';
      }
      const p = project.projects_id;
      return p.project_link || p.link || (p.slug ? './' + p.slug + '.html' : '#');
    },

    toggle(key) {
      if(this[key+'_toggle'] == false) this[key+'_toggle'] = true;
      else this[key+'_toggle'] = false;
    },
    teamMore(slug) {
      window.location.href= './' + slug+'.html';
    }
  }
});
