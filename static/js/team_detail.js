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
      more_body: false,
      news_toggle:false,
      publications_toggle:false,
      projects_toggle:false,
      events_toggle:false,
      meta_title:'',
      meta_content:'',
      meta_image: '',
      twitter_title:'',
      twitter_image:'',
      twitter_desc:'',
      apiURL: 'https://directus.thegovlab.com/thegovlab/items/team?filter[slug][like]=',
      apiApp: '&fields=*.*,books.books_id.*,videos.directus_files_id.*,projects.projects_id.*'

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
      const client = new DirectusSDK({
        url: "https://directus.thegovlab.com/",
        project: "thegovlab",
        storage: window.localStorage
      });

      client.getItems(
  'team',
  {
    filter: {
      slug: self.memberslug
    },
    fields: ['*.*','books.books_id.*','videos.directus_files_id.*','books.books_id.picture.*','projects.projects_id.*','bio_events.events_id.*','bio_courses.courses_id.*']
  }
).then(data => {

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
    console.log(textA, textB);
    return (textA < textB) ? -1 : (textA > textB) ? 1 : 0;
});
data.data[0].bio_events.reverse();
console.log('data', data.data[0].bio_events);

  self.memberData = data.data[0];
  self.meta_title = 'The Govlab '+self.memberData.name;
  self.meta_content = self.memberData.bio_short;
  self.meta_image = self.memberData.picture.data.full_url;
})
.catch(error => console.error(error));
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
