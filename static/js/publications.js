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
Vue.use(VueGtag, {
  config: { id: "UA-40012093-4" }
});
new Vue({

  el: '#publications',

  data () {
    return {
      pubData: [],
      client:[],
      pubtitle:'',
      puburl:'',
      pub_date_order: 'asc',
      title_order: 'asc',
      meta_title: 'The GovLab | Publications',
      meta_content: 'Deepening our understanding of how to govern more effectively and legitimately through technology.',
      picURL2020: 'https://thegovlab-files.nyc3.cdn.digitaloceanspaces.com/thegovlab-directus/uploads/thegovlab/originals/'
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
    this.fetchPubs();
  },
  methods: {

    fetchPubs() {
      self = this;
      this.client = new DirectusSDK({
        url: "https://directus.theburnescenter.org/",
        project: "/",
        storage: window.localStorage
      });

      this.client.getItems(
  'publications',
  {
    limit: '-1',
    sort: 'pub_date',
    fields: ['*.*','picture.*']
  }
).then(data => {

  self.pubData = data.data.reverse();

})
.catch(error => console.error(error));
    },
  accessPub(title, url){
    self = this;
    self.pubtitle = title;
    self.puburl = url;
    this.$gtag.event('publication', {
    'event_category':'Publications',
    'event_label': self.pubtitle,
    'value':  parseInt(1)
  })

},
  sortL (key) {
    self = this;

    self.pubData.sort(function(a, b) {
    var textA = a[key];
    var textB = b[key];
    if(self[key + '_order'] == 'asc') return (textA < textB) ? -1 : (textA > textB) ? 1 : 0;
    else return (textA > textB) ? -1 : (textA < textB) ? 1 : 0;
  })
  self[key + '_order'] == 'asc' ? self[key + '_order'] = 'desc' : self[key + '_order'] = 'asc';
  },
  formatDate(date) {
  return moment(date).format('MMMM YYYY');
  }
  }

});
