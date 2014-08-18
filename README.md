# The MusicMap Globe

This WebGL globe was created as part of the [MusicMap](http://www.getmusicmap.com)
Spotify application. It has two dependencies: [jQuery](http://jquery.com/) and [Three.js](http://threejs.org/).

[This blog post](http://www.jensljungblad.com/blog/2014/08/18/the-musicmap-globe/) outlines how the globe was built.

## Acknowledgments

The globe is based on the 
[The WebGL Globe project](http://www.chromeexperiments.com/globe),
with many of the improvements available from 
[Making of the World Wonders 3D Globe](http://www.html5rocks.com/en/tutorials/webgl/globe/).

In order to determine which country is being hovered, it uses the country lookup texture from
[Small Arms and Ammunition - Imports & Exports](http://workshop.chromeexperiments.com/projects/armsglobe).

## Installation

In order for the country lookup texture to load, you need to serve the page from a local web server. If you're on Mac, try opening the Terminal, navigate to the project directory and run:

```
$ python -m SimpleHTTPServer
```

Then visit [http://localhost:8000](http://localhost:8000)

## Usage

```javascript
jQuery(function($) {
  // Call initialize with a DOM-element to render the globe
  window.MusicMap.GlobeModule.initialize($('#globe'));
  
  // Call autospin to make the globe slowly spin by itself
  window.MusicMap.GlobeModule.autospin(true);

  // Bind to the musicmap:globe:click event to learn what country was clicked
  $('body').on('musicmap:globe:click', function(e, country) {
    console.log(country);
  });
});
```

## Contributing

1. Fork it
2. Create your feature branch (`git checkout -b my-new-feature`)
3. Commit your changes (`git commit -am 'Add some feature'`)
4. Push to the branch (`git push origin my-new-feature`)
5. Create new Pull Request
