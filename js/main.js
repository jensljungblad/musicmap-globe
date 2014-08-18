window.MusicMap = window.MusicMap || {};

jQuery(function($) {
  window.MusicMap.GlobeModule.initialize($('#globe'));
  window.MusicMap.GlobeModule.autospin(true);

  $('body').on('musicmap:globe:click', function(e, country) {
    console.log(country);
  });
});
