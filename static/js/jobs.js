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

  el: '#job-board',

  data () {
    return {
      jobData: [],
      jobs_toggle:false,
      index_val:1000,
      apiURL: 'https://directus.theburnescenter.org/'
    }
  },

  created: function created() {
    this.fetchTeam();
  },
  methods: {

    fetchTeam() {
      self = this;
      const client = new DirectusSDK({
        url: "https://directus.theburnescenter.org/",
        project: "/",
        storage: window.localStorage
      });

      client.getItems(
  'jobs',
  {
    fields: ['*.*']
  }
).then(data => {
  console.log(data);
  data.data.map(function(a,b){ a["toggle"] = false})
  self.jobData = data.data;


})
.catch(error => console.error(error));
    },
    toggle(index) {
      console.log(this.jobData[index]);
      if(!this.jobData[index].toggle) { this.jobData[index].toggle = true;}
      else {this.jobData[index].toggle = false;}
      console.log(this.jobData[index].toggle);
    }
  }
});
