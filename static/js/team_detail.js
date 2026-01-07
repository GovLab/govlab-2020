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
      // apiURL: 'https://directus.thegovlab.com/thegovlab/items/team?filter[slug][like]=',
      apiURL: 'https://burnes-center.directus.app/items/team?filter[slug][like]=',
      apiApp: '&fields=*.*,books.books_id.*,videos.directus_files_id.*,projects.projects_id.*',
      combinedPublications: '' // Store combined publications + blogs

    }
  },
metaInfo () {
     return {
       title: this.meta_title,
       meta: [

      {name: 'twitter:card', content: 'summary_large_image'},
       {name: 'twitter:title', content: this.meta_title},
       {name: 'twitter:description', content: this.meta_content},
       // image must be an absolute path
       {name: 'twitter:image', content: this.meta_image},
       // Facebook OpenGraph
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
  console.log(data)
  // Sort books
  data.data[0].books.sort(function(a, b) {
    var textA = a.books_id.title.toUpperCase();
    var textB = b.books_id.title.toUpperCase();
    return (textA < textB) ? -1 : (textA > textB) ? 1 : 0;
});
  // Sort talks
  data.data[0].bio_events.sort(function(a, b) {

    var textA = moment(a.events_id.from).format('X');
    var textB = moment(b.events_id.from).format('X');
    if(textA == 'Invalid date')textA = '1357018200';
    if(textB == 'Invalid date')textB = '1357018200';
    
    return (textA < textB) ? -1 : (textA > textB) ? 1 : 0;
});
console.log(data.data[0].bio_events);
data.data[0].bio_events.reverse();
console.log('data', data.data[0].bio_events);

  self.memberData = data.data[0];
  self.meta_title = 'The Govlab '+self.memberData.name;
  self.meta_content = self.memberData.bio_short;
  self.meta_image = self.memberData.picture;
  
  // Fetch blogs for this team member and combine with publications
  self.fetchBlogsAndCombine();
})
.catch(error => console.error(error));
    },
    
    fetchBlogsAndCombine() {
      self = this;
    
      this.client.getItems(
        'reboot_democracy_blog',
        {
          limit: -1,
          sort: '-date',
          fields: ['*.*', 'authors.*']
        }
      ).then(blogData => {
        const cutoffDate = new Date('2025-10-07');
        const today = new Date();
        today.setHours(23, 59, 59, 999); // End of today
        
        const filteredBlogs = blogData.data.filter(blog => {
          if (!blog.authors || !Array.isArray(blog.authors)) {
            return false;
          }
          
          // Check if author has team_id === 1
          const hasTeamId1 = blog.authors.some(author => author.team_id === 1);
          if (!hasTeamId1) {
            return false;
          }
          
          const blogDate = blog.date || blog.date2;
          if (!blogDate) {
            return false;
          }
          
          const blogDateObj = new Date(blogDate);
          return blogDateObj > cutoffDate && blogDateObj <= today;
        });
        
        const publicationsHTML = self.memberData.publications || '';
        const allItems = [];
        
        // Parse publications from HTML
        if (publicationsHTML) {
          const tempDiv = document.createElement('div');
          tempDiv.innerHTML = publicationsHTML;
          const pubListItems = tempDiv.querySelectorAll('li');
          
          pubListItems.forEach(li => {
            const html = li.outerHTML;
            const text = li.textContent || li.innerText || '';
            
            let date = null;
            const dateMatch = text.match(/(\d{4})/);
            if (dateMatch) {
              const year = parseInt(dateMatch[1]);
              const fullDateMatch = text.match(/(\w+\s+\d{1,2},?\s+\d{4})/i) || text.match(/(\d{1,2}\/\d{1,2}\/\d{4})/);
              if (fullDateMatch) {
                date = moment(fullDateMatch[1]).toDate();
              } else {
                date = new Date(year, 0, 1);
              }
            }
            
            allItems.push({
              html: html,
              date: date,
              type: 'publication'
            });
          });
        }
        
        // Add blogs to the items array
        filteredBlogs.forEach(blog => {
          const blogTitle = blog.title || 'Untitled';
          const blogLink = blog.fullURL || blog.external_link || (blog.slug ? `https://rebootdemocracy.ai/blog/${blog.slug}` : '#');
          const blogSource = 'Reboot Democracy';
          const blogDate = blog.date || blog.date2;
          const formattedDate = blogDate ? moment(blogDate).format('MMMM D, YYYY') : '';
          const date = blogDate ? new Date(blogDate) : null;
          
          allItems.push({
            html: `<li><a href="${blogLink}" target="_blank">${blogTitle}</a>, ${blogSource}${formattedDate ? `, ${formattedDate}` : ''}</li>`,
            date: date,
            type: 'blog'
          });
        });
        
        // Sort all items by date (most recent first)
        allItems.sort((a, b) => {
          // Items without dates go to the end
          if (!a.date && !b.date) return 0;
          if (!a.date) return 1;
          if (!b.date) return -1;
          return new Date(b.date) - new Date(a.date);
        });
        
        // Generate combined HTML
        let combinedHTML = '';
        allItems.forEach(item => {
          combinedHTML += item.html;
        });
        
        if (combinedHTML && !combinedHTML.trim().startsWith('<ul')) {
          self.combinedPublications = `<ul>${combinedHTML}</ul>`;
        } else {
          self.combinedPublications = combinedHTML || publicationsHTML;
        }
      })
      .catch(error => {
        console.error('Error fetching Reboot Democracy Blog:', error);
        self.combinedPublications = self.memberData.publications || '';
      });
    },
    toggle(key) {
      if(this[key+'_toggle'] == false) this[key+'_toggle'] = true;
      else this[key+'_toggle'] = false;
      console.log(this[key+'_toggle']);
    },
    teamMore(slug) {
      window.location.href= slug+'.html';
    }
  }
});
