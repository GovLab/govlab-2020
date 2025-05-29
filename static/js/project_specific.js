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
   $(window).on('load', function() {
      $('.b-project-slider').slick({
          arrows: false,
          infinite: false,
          draggable: false,
          centerMode: true,
          slidesToShow: 1,
          variableWidth: true,
          focusOnSelect: true,
          swipeToSlide: true,
          responsive: [
          {
              breakpoint: 800,
              settings: {
                  draggable: true,
                  slidesToShow: 1,
              }
          }
          ]
      });
  });
  }
}
main();

////////////////////////////////////////////////////////////
///// TEAM  API REQUEST ` `
////////////////////////////////////////////////////////////


const client=  new DirectusSDK({
  url: "https://directus.theburnescenter.org/",
  project: "/",
  storage: window.localStorage
})


// Vue.use(VueCarousel)

Vue.use(VueMeta);
new Vue({

  el: '#projectpage',
  // components: {
  //    "swiper" : VueAwesomeSwiper,
  //    "swiper-slide": VueAwesomeSwiper
  //  },
	data: {
    swiperOptions: {
  loop: true,
  height:500,
  spaceBetween:40,
  slidesPerView:1,
  centeredSlides: true,
  pagination: {
    el: '.swiper-pagination',
     clickable: true
  },
  navigation: {
    nextEl: '.swiper-button-next',
    prevEl: '.swiper-button-prev'
  }
},

      projectData: [],
      items: [],
      gallerInit: false,
      progessAr: ['m-define','m-prototype','m-test','m-complete'],
      progess:'',
      meta_title: 'The GovLab | Project',
      meta_image: '',
      meta_content: '',
      projectslug:'',
      apiURL: 'https://directus.theburnescenter.org/',
      picURL2020: 'https://thegovlab-files.nyc3.cdn.digitaloceanspaces.com/thegovlab-directus/uploads/thegovlab/originals/'
  },

  // metaInfo () {
  //       return {
  //         title: this.meta_title,
  //         meta: [
  //           {title: this.meta_title, property:'og:title'},
  //     {  name: 'description', content: this.meta_content, property:'og:description'}
  //   ]
  //   }
  // },
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
          {property: 'og:site_name', content: 'The Govlab Project'},
          {property: 'og:type', content: 'website'},
          {property: 'og:image', content: this.meta_image},
          {property: 'og:description', content:  this.meta_content},
          { itemprop:'name', content: this.meta_title},
          { itemprop:'image', content: this.meta_image},
          { itemprop:'description', content: this.meta_content}
    ]
    }
  },
  created: function created() {
    this.projectslug=window.location.href.split('/');
    this.projectslug = this.projectslug[this.projectslug.length - 1];
    this.projectslug=this.projectslug.split('#');
    this.projectslug = this.projectslug[0];
    // this.projectslug = "project-data-assembly";
    
    console.log(this.projectslug);
    this.fetchProject();
  },
mounted() {
  this.$nextTick(function () {
    // this.gallerInit = true;
    console.log(this.gallerInit);
    console.log('this mounted',this);
    console.log('window mounted',window);

    setTimeout(function () {
      $('.b-project-slider').slick({
          arrows: false,
          infinite: false,
          draggable: false,
          centerMode: true,
          slidesToShow: 1,
          variableWidth: true,
          focusOnSelect: true,
          swipeToSlide: true,
          responsive: [
          {
              breakpoint: 800,
              settings: {
                  draggable: true,
                  slidesToShow: 1,
              }
          }
          ]
      });
    }, 500);


  })
},
  methods: {
    onSetTranslate() {
      console.log('onSetTranslate')
    },
    onSwiperSlideChangeTransitionStart() {
      console.log('onSwiperSlideChangeTransitionStart')
    },
    onSwiperClickSlide(index, reallyIndex) {
      console.log('Swiper click slide!', reallyIndex)
    },

    fetchProject() {
      self = this;

client.getItems(
  'projects',
  {
    filter: {
      slug: self.projectslug
    },
    fields: ['*.*','picture.*','project_team.team_id.*','gallery.*','project_team.team_id.picture.*']
  }
  ).then(data => {

  return data;

}).then(data2 => {
    console.log(data2)
    self.progess = self.progessAr[data2.data[0].progress];
    self.meta_title = 'The GovLab | '+data2.data[0].name;
    self.meta_content = data2.data[0].description;
    self.meta_image =  data2.data[0].picture ? data2.data[0].picture.id : data2.data[0].main_picture_2020
    self.items = data2.data[0].gallery? data2.data[0].gallery:data2.data[0].gallery_2020;
    
    self.projectData = data2.data[0];
    // self.projectData.project_team.map(b=>{console.log(b.)})
    self.projectData.project_team.sort((a, b) =>  b.team_id && b.team_id.slug && (b.team_id.slug == 'stefaan-verhulst' || b.team_id.slug == 'beth-simone-noveck') ? 1 : -1);
    // console.log(self.projectData )
    


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
      window.location.href= 'www.thegovlab.org'+slug+'.html';
    },
    isMobile() {
    	if(/Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent)) {
    		return true
    	} else {
    		return false
    	}
    },
  }
});

