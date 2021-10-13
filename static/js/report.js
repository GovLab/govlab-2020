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

  el: '#reportpage',

  data () {
    return {
      reportData: [],
      authorData:[],
      maintag:[],
      subtag:[],
      meta_title: 'The GovLab | Government Reform',
      meta_content: 'Building new technology to solve public problems. Our projects try to answer the questions that stand between today and more effective and legitimate governance tomorrow.',
      apiURL: 'https://directus.thegovlab.com/thegovlab/items/paul_light_report'
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
    this.fetchReport();
    this.fetchAuthor();
    window.addEventListener('scroll', this.scrollToAnchor);
    
  },
  methods: {

    fetchReport() {
      self = this;
      const client = new DirectusSDK({
        url: "https://directus.thegovlab.com/",
        project: "thegovlab",
        storage: window.localStorage
      });

      client.getItems(
  'paul_light_report',
  {

    fields: ['*.*']
  }
).then(data => {
  self.reportData = data.data;
})
.catch(error => console.error(error));
    },
    fetchAuthor() {
      self = this;
      const client = new DirectusSDK({
        url: "https://directus.thegovlab.com/",
        project: "thegovlab",
        storage: window.localStorage
      });

      client.getItems(
  'team',
  {
    fields: ['*.*'],
    filter: {
      slug: 'paul-light'
    },
  }
).then(data => {
  self.authorData = data.data;
})
.catch(error => console.error(error));
    },

  smoothScroll (section_var) {
  var element = document.getElementById(section_var);
  element.scrollIntoView({ behavior: 'smooth'});
  console.log("trigger");
},

    scrollToAnchor () {

      var intro_section = document.getElementById('introduction');
      var reportsection1 = document.getElementById('section1');
      var reportsection2 = document.getElementById('section2');
      var reportsection3 = document.getElementById('section3');
      var reportsection4 = document.getElementById('section4');
      var reportsection5 = document.getElementById('section5');
      var reportsection6 = document.getElementById('section6');
      var endnotes_section = document.getElementById('endnotes');
      var intro = document.getElementsByClassName('toc-1');
      var section1 = document.getElementsByClassName('toc-2');
      var section2 = document.getElementsByClassName('toc-3');
      var section3 = document.getElementsByClassName('toc-4');
      var section4 = document.getElementsByClassName('toc-5');
      var section5 = document.getElementsByClassName('toc-6');
      var section6 = document.getElementsByClassName('toc-7');
      var endnotes = document.getElementsByClassName('toc-8');
      if(intro_section.offsetTop - 10 <= $(window).scrollTop()) {
        intro[0].classList.add("active");
        section1[0].classList.remove("active");
      }   
      if(reportsection1.offsetTop - 10 <= $(window).scrollTop()) {
        intro[0].classList.remove("active");
        section1[0].classList.add("active");
        section2[0].classList.remove("active");
      }   
      if(reportsection2.offsetTop - 10 <= $(window).scrollTop()) {
        section2[0].classList.add("active");
        section1[0].classList.remove("active");
        section3[0].classList.remove("active");
      }   
      if(reportsection3.offsetTop - 10 <= $(window).scrollTop()) {
        section3[0].classList.add("active");
        section2[0].classList.remove("active");
        section4[0].classList.remove("active");
      }   
      if(reportsection4.offsetTop - 10 <= $(window).scrollTop()) {
        section4[0].classList.add("active");
        section3[0].classList.remove("active");
        section5[0].classList.remove("active");
      }   
      if(reportsection5.offsetTop - 10 <= $(window).scrollTop()) {
        section5[0].classList.add("active");
        section4[0].classList.remove("active");
        section6[0].classList.remove("active");
      }   
      if(reportsection6.offsetTop - 10 <= $(window).scrollTop()) {
        section5[0].classList.remove("active");
        section6[0].classList.add("active");
        endnotes[0].classList.remove("active");
      }  
      if(endnotes_section.offsetTop - 10 <= $(window).scrollTop()) {
        section6[0].classList.remove("active");
        endnotes[0].classList.add("active");
      }   
    }
  }
});
