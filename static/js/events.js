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

  el: '#event-page',

  data () {
    return {
      eventsData: [],
      currentDate: '',
      iniLoad: 0,
      more_body: false,
      meta_title: 'The GovLab | Events',
      meta_content: 'Deepening our understanding of how to govern more effectively and legitimately through technology.',
      apiURL: 'https://directus.theburnescenter.org/items/events?sort=from'
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
    this.fetchEvents();
  },
updated () {
this.scrollToAnchor();
},
  methods: {

    fetchEvents() {
      self = this;
      const client = new DirectusSDK({
        url: "https://directus.theburnescenter.org/",
        project: "/",
        storage: window.localStorage
      });

      client.getItems(
  'events',
  {
  //   filter: {
  //   talk: true
  // },
    sort: '-from',
    fields: ['*.*']
  }
).then(data => {

  this.currentDate = moment().tz("America/Toronto").format('YYYY-MM-DD');
  self.eventsData = data.data;
  console.log(self.eventsData);

})
.catch(error => console.error(error));
    },
    showDesc(eventO) {
      eventO['extended'] = true;
    },
    showExc(eventO) {
      eventO['extended'] = false;
    },
    dateShow(date) {
      return moment(date).format("LL");
    },
    eventMore(link) {
      window.open(link, '_blank');

    },
    scrollToAnchor () {
  this.$nextTick(() => {
    if(window.location.hash && this.iniLoad==0) {
      const $el = document.getElementById(window.location.hash.substring(1));
      $el && window.scrollTo(0, $el.offsetTop);
       this.iniLoad = 1;
    }
  });
}
  }
});
