$(document).ready(function() {
  'use strict';

  // Stage Tabs
  $('.tab-links > span').click(function() {
    var $this = $(this);

    if ($this.hasClass('active')) {
      $($this.attr('data-target')).slideUp(function() {
        $this.removeClass('active');
      });

    } else {
      $('.tab-links > span.active').removeClass('active');
      $('.tab-content:visible').hide();
      $this.addClass('active');
      $($this.attr('data-target')).slideDown();
    }
  });

  // Team Info
  $('.team-member').click(function() {
    var $this = $(this),
        target = $this.attr('data-name');

    if ($this.hasClass('active')) {
      // Hide info.
      $('.team-member-info:visible').slideUp(function() {
        $this.removeClass('active');
      });
    } else {
      // Hide opened info.
      $('.team-member-info:visible').hide();
      $('.team-member.active').removeClass('active');

      // Show new info.
      $this.addClass('active');
      $('#' + target + '-info').slideDown();
    }
  });

  var totalHeight = $('html').css('height');
  $('#menu').css('height', totalHeight);

  // Triggers the super menu
  $('#menu .trigger').click(function(){
    $('#menu').addClass('s-active');
    $('.page').addClass('s-menu-active');
    $('#overlay').show();
  });

  // Triggers the Overlay
  $('#overlay').click(function() {
    $('#menu').removeClass('s-active');
    $('.page').removeClass('s-menu-active');
    $('#overlay').hide();
  });

  // Smooth Scrolling Function
  $(function() {
    $('a[href*=#]:not([href=#])').click(function() {
      var locationPath = location.pathname.replace(/^\//,''),
          thisPath = this.pathname.replace(/^\//,'');

      if (locationPath == thisPath || location.hostname == this.hostname) {
        var locator = '[name=' + this.hash.slice(1) +']',
            target = $(this.hash).length ? $(this.hash) : $(locator);

        if (target.length) {
          $('html,body').animate({
            scrollTop: target.offset().top
          }, 1000);
          return false;
        }
      }
    });
  });
});
