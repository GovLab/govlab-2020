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

  el: '#site-page',

  data () {
    return {
      sitesData: [],
      client:[],
      apiURL: 'https://content.thegovlab.com/',
      picURL2020: 'https://thegovlab-files.nyc3.cdn.digitaloceanspaces.com/thegovlab-directus/uploads/thegovlab/originals/'

    }
  },
  created: function created() {
    this.fetchSites();
  },
  methods: {

    fetchSites() {
      self = this;
      this.client = new DirectusSDK({
        url: "https://content.thegovlab.com/",
        project: "/",
        storage: window.localStorage
      });

      this.client.getItems(
  'sites',
  {
    fields: ['*.*','thumbnail.*']
  }
).then(data => {
  self.sitesData = data.data;

})
.catch(error => console.error(error));
    }
  }
});
