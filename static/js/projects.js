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

  el: '#projectlist',

  data () {
    return {
      projectsData: [],
      maintag:[],
      subtag:[],
      client:[],
      listview: false,
      meta_title: 'The GovLab | Projects',
      meta_content: 'Building new technology to solve public problems. Our projects try to answer the questions that stand between today and more effective and legitimate governance tomorrow.',
      apiURL: 'https://burnes-center.directus.app/'
    }
  },
  metaInfo () {
        return {
          title: this.meta_title,
          meta: [
            {title: this.meta_title, property:'og:title'},
      {  name: 'description', content: this.meta_content, property:'og:description'}
    ]
    }
  },
  created: function created() {
    this.fetchProjects();
  },
  methods: {

    fetchProjects() {
      self = this;
      this.client= new DirectusSDK({
        url: "https://burnes-center.directus.app/",
        project: "/",
        storage: window.localStorage
      });

      this.client.getItems(
  'projects',
  {
    sort: '-order',
    fields: ['*.*','main_picture.*','subtag.*'],
    filter: {    status: {
      _eq: "published"
      
    }},

  }
).then(data => {
 console.log(data)
 this.client.get('https://burnes-center.directus.app/flows/trigger/75e27ce9-84a5-4c8b-bdf0-214126bce0b4').then(tags =>{
  
 self.maintag = tags.maintags
 self.subtag = tags.subtags
 var test = self.subtag[self.subtag.findIndex(s=>{returns.value==0})]
 console.log(self.maintag, self.subtag, test);
 })



  
  return data;

}).then(data2 => {

    self.projectsData = data2.data;

})
.catch(error => console.error(error));
    },
    showList() {
      this.listview = true;
      console.log('her');
    },
    showThumb() {
      this.listview = false;
    },
    projectsMore(slug) {
      window.location.href= 'www.thegovlab.org'+slug;
    }
  }
});
