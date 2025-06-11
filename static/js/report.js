////////////////////////////////////////
// reload page after Forward and back
///////////////////////////////////////

const TYPE_BACK_FORWARD = 2;

function isReloadedPage() {
  // performance.navigation is deprecated.
  // Use PerformanceNavigationTiming for modern browsers.
  const navEntries = performance.getEntriesByType("navigation");
  if (navEntries.length > 0 && navEntries[0].type) {
    return navEntries[0].type === 'back_forward';
  }
  // Fallback for older browsers (though it's deprecated)
  if (performance.navigation) {
    return performance.navigation.type === TYPE_BACK_FORWARD;
  }
  return false;
}

function main() {
  if (isReloadedPage()) {
    window.location.reload();
  }
}
main();

////////////////////////////////////////////////////////////
///// TEAM  API REQUEST
////////////////////////////////////////////////////////////


Vue.use(VueMeta);
new Vue({
  el: '#reportpage',
  data () {
    return {
      reportData: [], // Initialize as an empty array
      authorData: [], // Initialize as an empty array
      // maintag:[], // Not used in the provided code
      // subtag:[], // Not used in the provided code
      meta_title: 'The GovLab | Government Reform',
      meta_content: 'Building new technology to solve public problems. Our projects try to answer the questions that stand between today and more effective and legitimate governance tomorrow.',
      // apiURL is defined but not used by DirectusSDK in methods.
      // The SDK client is hardcoded with "https://burnes-center.directus.app/"
      // apiURL: 'https://directus.thegovlab.com/thegovlab/items/paul_light_report'
    }
  },
  metaInfo () {
    return {
      title: this.meta_title,
      meta: [
        {title: this.meta_title, property:'og:title'},
        {name: 'description', content: this.meta_content, property:'og:description'}
      ]
    }
  },
  created: function created() {
    this.fetchReport();
    this.fetchAuthor();
    window.addEventListener('scroll', this.scrollToAnchor);
  },
  // Optional: Good practice to remove listener when component is destroyed
  beforeDestroy() {
    window.removeEventListener('scroll', this.scrollToAnchor);
  },
  // In your report.js Vue instance methods:

methods: {
  fetchReport() {
    const client = new DirectusSDK({
      url: "https://burnes-center.directus.app/",
      project: "/",
      // storage: window.localStorage // Usually not needed for GET requests
    });

    client.getItems(
      'paul_light_report',
      {
        fields: ['*.*']
      }
    ).then(response => { // Changed 'data' to 'response' for clarity with response.data
      console.log('Raw API response for report:', response); // For debugging the whole response
      if (response && response.data) {
        // CRUCIAL FIX: Ensure reportData is an array
        if (!Array.isArray(response.data)) {
          // If response.data is a single object, wrap it in an array
          this.reportData = [response.data];
          console.log('Report data (single object) wrapped in array:', JSON.parse(JSON.stringify(this.reportData)));
        } else {
          // If response.data is already an array
          this.reportData = response.data;
          console.log('Report data (already array):', JSON.parse(JSON.stringify(this.reportData)));
        }
      } else {
        console.error('Report data received is not in expected format or is empty:', response);
        this.reportData = []; // Fallback to empty array
      }
    })
    .catch(error => {
        console.error('Error fetching report:', error);
        this.reportData = []; // Set to empty array on error to satisfy v-if checks
    });
  },

  fetchAuthor() {
    const client = new DirectusSDK({
      url: "https://burnes-center.directus.app/",
      project: "/",
      // storage: window.localStorage
    });

    client.getItems(
      'team',
      {
        fields: ['*.*'],
        filter: {
          slug: 'paul-light'
        },
      }
    ).then(response => { // Changed 'data' to 'response'
      console.log('Raw API response for author:', response);
      if (response && response.data) {
        // Directus usually returns an array for filtered items, but good to be safe
        if (!Array.isArray(response.data)) {
            this.authorData = [response.data];
            console.log('Author data (single object) wrapped in array:', JSON.parse(JSON.stringify(this.authorData)));
        } else {
            this.authorData = response.data;
            console.log('Author data (already array):', JSON.parse(JSON.stringify(this.authorData)));
        }

        // Add detailed logging for the problematic path in the template
        if (this.authorData.length > 0 && this.authorData[0]) {
            console.log('Checking authorData[0].picture:', this.authorData[0].picture);
            if (this.authorData[0].picture && this.authorData[0].picture.data) {
                console.log('Checking authorData[0].picture.data.thumbnails:', this.authorData[0].picture.data.thumbnails);
                 if (this.authorData[0].picture.data.thumbnails && this.authorData[0].picture.data.thumbnails[3]) {
                    console.log('Author thumbnail URL should be accessible.');
                 } else {
                    console.warn('Author thumbnail path missing thumbnails[3]');
                 }
            } else {
                console.warn('Author thumbnail path missing picture.data');
            }
        }

      } else {
        console.error('Author data received is not in expected format or is empty:', response);
        this.authorData = []; // Fallback to empty array
      }
    })
    .catch(error => {
        console.error('Error fetching author:', error);
        this.authorData = []; // Set to empty array on error
    });
  },

  // ... your other methods (smoothScroll, scrollToAnchor)
  smoothScroll (section_var) {
    var element = document.getElementById(section_var);
    if (element) {
      element.scrollIntoView({ behavior: 'smooth'});
      console.log("smoothScroll triggered for:", section_var);
    } else {
      console.warn("smoothScroll: Element not found -", section_var);
    }
  },

  scrollToAnchor () {
    if (!this.reportData || this.reportData.length === 0) { // Check if reportData is populated
      return;
    }

    const getElementAndToc = (id, tocClass) => {
      const section = document.getElementById(id);
      const tocLinks = document.getElementsByClassName(tocClass);
      return { section, tocLink: tocLinks.length > 0 ? tocLinks[0] : null };
    };

    const sections = [
      getElementAndToc('introduction', 'toc-1'),
      getElementAndToc('section1', 'toc-2'),
      getElementAndToc('section2', 'toc-3'),
      getElementAndToc('section3', 'toc-4'),
      getElementAndToc('section4', 'toc-5'),
      getElementAndToc('section5', 'toc-6'),
      getElementAndToc('section6', 'toc-7'),
      getElementAndToc('section7', 'toc-8'),
      getElementAndToc('endnotes', 'toc-9'),
    ];

    let activeFound = false;
    const scrollTop = window.pageYOffset || document.documentElement.scrollTop || document.body.scrollTop || 0;
    const offset = 150; // How many pixels before the top of the section it becomes active

    for (let i = sections.length - 1; i >= 0; i--) {
      const current = sections[i];
      if (current.section && current.tocLink) {
        // Check if section exists and its offsetTop is a valid number
        if (typeof current.section.offsetTop === 'number' && (current.section.offsetTop - offset) <= scrollTop) {
          if (!activeFound) {
            current.tocLink.classList.add("active");
            activeFound = true;
          } else {
            current.tocLink.classList.remove("active");
          }
        } else {
          current.tocLink.classList.remove("active");
        }
      } else {
        // console.warn(`Section or TOC link not found for ID: ${sections[i].id_placeholder} or class: ${sections[i].toc_placeholder}`);
      }
    }
    if (!activeFound && sections[0] && sections[0].section && sections[0].tocLink && typeof sections[0].section.offsetTop === 'number') {
        if ((sections[0].section.offsetTop - offset) <= scrollTop) {
             sections[0].tocLink.classList.add("active");
        } else {
             sections[0].tocLink.classList.remove("active");
        }
    }
  }
}
});