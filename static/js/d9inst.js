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
      D9InsttData: [],
      apiURLD9: 'https://d9.thegovlab.com/'
    }
  },
  created: function created() {

    this.fetchD9Inst();
  },
  methods: {

    fetchD9Inst() {
      self = this;
      axios.get(this.apiURLD9+"items/thegovlab_directus9_instances").then(data => {
        
        self.D9InsttData = data.data.data.sort( function(a,b){  return (a.name < b.name) ? -1 : (a.name > b.name) ? 1 : 0});
        

      }).catch(error => console.error(error));
    }
  }
});
