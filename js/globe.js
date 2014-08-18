;window.MusicMap.GlobeModule = (function($) {
  'use strict';

  var autospinEnabled = false;
  var camera;
  var cameraTarget = { x: 0, y: 0, z: 0 };
  var countryLabel;
  var countryLabelText;
  var distance = 1000;
  var distanceTarget = 1000;
  var dragging = false;
  var el;
  var globe;
  var globeRadius = 200;
  var height;
  var hoveredCountry;
  var isZooming = true;
  var lookupTexture;
  var mouse = { x: 0, y: 0 };
  var mouseDown = false;
  var mouseOnDown = { x: 0, y: 0 };
  var requestId;
  var renderer;
  var rotation = { x: 3.74, y: 0.5 }; // initial rotation
  var scene;
  var target = { x: rotation.x, y: rotation.y }; // initial camera target
  var targetOnDown = { x: 0, y: 0 };
  var width;

  /* initialization */

  var initialize = function(element) {

    el = element;

    // renderer size
    width  = el.width();
    height = el.height();

    // camera attributes
    var fov    = 40;
    var aspect = width / height;
    var near   = 1;
    var far    = 1900;

    // initialize renderer
    renderer = new THREE.WebGLRenderer();
    renderer.setClearColor(0x333333);
    renderer.setSize(width, height);

    // context lost and found events which can fire anytime
    renderer.context.canvas.addEventListener("webglcontextlost", handleContextLost, false);
    renderer.context.canvas.addEventListener("webglcontextrestored", handleContextRestored, false);

    // append renderer to container element
    el.html(renderer.domElement);

    // initialize scene and camera
    scene  = new THREE.Scene();
    camera = new THREE.PerspectiveCamera(fov, aspect, near, far);

    // initialize objects
    initializeGlobe();
    initializeCountryLabel();
    initializeLookupTexture();

    // set up events
    el.on('mousedown', mouseDownHandler);
    el.on('mouseup', mouseUpHandler);
    el.on('mousemove', mouseMoveHandler);
    el.on('mousewheel', mouseWheelHandler);

    // resize event needs to go on window because of jquery limitation
    $(window).on('resize', resizeHandler);

    render();
  };

  var initializeGlobe = function() {
    globe = new THREE.Object3D();

    initializeSphere();
    initializeContinents();
    initializeCountries();
    initializeCoastlines();
    initializeSpace();

    scene.add(globe);
  };

  var vertexShader = function() {
    return [
      'varying vec3 vNormal;',
      'void main() {',
        'vec4 pos = projectionMatrix * modelViewMatrix * vec4( position, 1.0 );',
        'vNormal = normalize( normalMatrix * normalize( position ));',
        'gl_Position = pos;',
      '}'
    ].join('\n');
  };

  var fragmentShader = function(r, g, b) {
    return [
      'varying vec3 vNormal;',
      'void main() {', //                                             placement     darkness   size
        'float i =      pow(clamp(dot( vNormal, normalize(vec3( 0.0,  0.5, 1.0 ))), 0.0, 1.0), 1.0);',
        'float i2 = 0.8-pow(clamp(dot( vNormal, normalize(vec3( 0.0, -0.0, 1.0 ))), 0.0, 1.0), 1.7);',
        'gl_FragColor = vec4(' + (r / 255) + ', ' + (g / 255) + ', ' + (b / 255) + ', 1.0) * vec4(i*i*i+0.0*clamp(i2,0.0,1.0));',
        'gl_FragColor.a = 1.0;',
      '}'
    ].join('\n');
  };

  var initializeSphere = function() {
    var sphereGeometry = new THREE.SphereGeometry(globeRadius, 50, 50);
    var sphereMaterial = new THREE.ShaderMaterial({vertexShader: vertexShader(), fragmentShader: fragmentShader(40, 40, 40)});
    var sphere         = new THREE.Mesh(sphereGeometry, sphereMaterial);

    globe.add(sphere);
  };

  var initializeContinents = function() {
    var continentsGeometry = getWorld;
    var continentsMaterial = new THREE.ShaderMaterial({vertexShader: vertexShader(), fragmentShader: fragmentShader(122, 184, 0)});
    var continents         = loadTriMesh(continentsGeometry, continentsMaterial);

    globe.add(continents);
  };

  var initializeCountries = function() {
    var countriesGeometry = getCountry;
    var countriesMaterial = new THREE.LineBasicMaterial({color: 0x111111});
    var countries         = loadLineMesh(countriesGeometry, countriesMaterial);

    globe.add(countries);
  };

  var initializeCoastlines = function() {
    var coastlinesGeometry = getCoast;
    var coastlinesMaterial = new THREE.LineBasicMaterial({color: 0x111111});
    var coastlines         = loadLineMesh(coastlinesGeometry, coastlinesMaterial);

    globe.add(coastlines);
  };

  var initializeSpace = function() {
    var spaceDistance = globeRadius + 800;

    var spaceGeometry = new THREE.SphereGeometry(spaceDistance, 50, 50);
    var spaceMaterial = new THREE.MeshLambertMaterial({color: 0x111111, side: THREE.BackSide});
    var space         = new THREE.Mesh(spaceGeometry, spaceMaterial);

    scene.add(space);

    initializeSpaceGradient();
    initializeStars(spaceDistance);
  };

  var initializeSpaceGradient = function() {
    var light = new THREE.SpotLight(0xffffff, 1.8);

    light.position = camera.position;

    scene.add(light);
  };

  var initializeCountryLabel = function() {
    countryLabel     = $("<div>", { id: "globe-country-label" });
    countryLabelText = $("<span>");
    countryLabel.append(countryLabelText);
    countryLabel.append($("<small>Click to play</small>"));
    countryLabel.appendTo(el);
  };

  var initializeStars = function(spaceDistance) {
    var addStar = function(s, t) {
      var starGeometry = new THREE.SphereGeometry(1.65, 10, 10);
      var starMaterial = new THREE.MeshBasicMaterial({color: 0x999999});
      var star         = new THREE.Mesh(starGeometry, starMaterial);

      star.position.x = (spaceDistance - 10) * Math.cos(s) * Math.sin(t);
      star.position.y = (spaceDistance - 10) * Math.sin(s) * Math.sin(t);
      star.position.z = (spaceDistance - 10) * Math.cos(t);

      globe.add(star);
    };

    for (var i = 0; i < 300; i++) {
      var s = Math.random() * (Math.PI * 2 - 0) + 0;
      var t = Math.random() * (Math.PI - 0) + 0;
      addStar(s, t);
    };
  };

  var initializeLookupTexture = function() {
    var width          = 2048;
    var height         = 1024;
    var fov            = 40;
    var aspect         = width / height;
    var dpr            = (window.devicePixelRatio) ? window.devicePixelRatio : 1;
    var cameraDistance = 900;
    var renderer       = new THREE.WebGLRenderer({ preserveDrawingBuffer: true });

    renderer.setClearColor(0x222222);
    renderer.setSize(width/dpr, height/dpr);

    var scene  = new THREE.Scene();
    var camera = new THREE.PerspectiveCamera(fov, aspect, 1, 1000);

    camera.position.z = cameraDistance;

    var planeHeight = 2 * Math.tan((fov * Math.PI / 180) / 2) * cameraDistance;
    var planeWidth  = planeHeight * aspect;

    var texture = THREE.ImageUtils.loadTexture('images/map_indexed.png', null, function() {
      texture.minFilter = THREE.NearestFilter;
      texture.magFilter = THREE.NearestFilter;

      var planeGeometry = new THREE.PlaneGeometry(planeWidth, planeHeight);
      var planeMaterial = new THREE.MeshBasicMaterial({map: texture});
      var plane         = new THREE.Mesh(planeGeometry, planeMaterial);

      scene.add(plane);

      renderer.render(scene, camera);
    });

    lookupTexture = {
      renderer: renderer,
      width: width,
      height: height
    };
  };

  /* rendering and camera movement */

  var autospin = function(enabled) {
    autospinEnabled = enabled;
  };

  var zoom = function(delta) {
    distanceTarget -= delta;
    distanceTarget = distanceTarget > 1000 ? 1000 : distanceTarget;
    distanceTarget = distanceTarget < 500 ? 500 : distanceTarget;
  };

  var render = function() {
    requestId = requestAnimationFrame(render);

    if (autospinEnabled) {
      target.x += 0.001;
    }

    // lots of math
    rotation.x += (target.x - rotation.x) * 0.1;
    rotation.y += (target.y - rotation.y) * 0.1;
    distance   += (distanceTarget - distance) * 0.3;

    var whenToTilt = 350;
    var nearY = -(1200-whenToTilt)/7;
    var nearTY = (1200-whenToTilt)/0.7;
    var nearPosZ = whenToTilt - (1200-whenToTilt)/200;
    var f = (distance - whenToTilt) / (1200-whenToTilt);
    var isnf = Math.pow(-Math.cos(f*Math.PI*2)*0.5+0.5, 0.33);
    var totald = 0;

    camera.position.z = f * distance + (1-f) * nearPosZ;
    camera.position.y = Math.pow((1-f), 4) * nearY;
    camera.fov = 30 + isnf * totald * 5;
    camera.updateProjectionMatrix();
    cameraTarget.y = Math.pow((1-f), 10) * nearTY;
    camera.lookAt(cameraTarget);

    globe.rotation.y = -rotation.x;
    globe.rotation.x = rotation.y;
    globe.updateMatrix();

    // finally, render the scene
    renderer.render(scene, camera);
  };

  /* conversion functions */

  var globeCoordinatesFromScreenCoordinates = function(x, y) {
    var vector    = new THREE.Vector3((x / width) * 2 - 1, - (y / height) * 2 + 1, 0.5);
    var projector = new THREE.Projector();

    projector.unprojectVector(vector, camera);

    var raycaster  = new THREE.Raycaster(camera.position, vector.sub(camera.position).normalize());
    var intersects = raycaster.intersectObject(globe.children[0], true);

    if (intersects.length > 0) {
      return globe.worldToLocal(intersects[0].point);
    } else {
      return false;
    }
  };

  var textureCoordinatesFromGlobeCoordinates = function(point) {
    var normalizedPoint = new THREE.Vector3().copy(point).normalize();

    var normalizedU = 0.5 + (Math.atan2(normalizedPoint.x, normalizedPoint.z) / (2 * Math.PI));
    var normalizedV = 0.5 - (Math.asin(normalizedPoint.y) / Math.PI);

    var offsetU = (Math.round(lookupTexture.width * 906/4096));
    var offsetV = (Math.round(lookupTexture.height * 19/2048));

    return {
      u: (Math.round(normalizedU * lookupTexture.width) + offsetU) % lookupTexture.width,
      v: (Math.round(normalizedV * lookupTexture.height) - offsetV) % lookupTexture.height
    };
  };

  var countryCodeFromTextureCoordinates = function(uv) {
    var gl    = lookupTexture.renderer.getContext();
    var top   = lookupTexture.height - uv.v;
    var left  = uv.u;
    var pixel = new Uint8Array(4);
    gl.readPixels(left, top, 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, pixel);
    return pixel[0];
  };

  var countryFromCountryCode = function(countryCode) {
    var locations = getLocation();
    return locations[countryCode];
  };

  var countryFromScreenCoordinates = function(x, y) {
    var point = globeCoordinatesFromScreenCoordinates(x, y);
    if (point) {
      var uv          = textureCoordinatesFromGlobeCoordinates(point);
      var countryCode = countryCodeFromTextureCoordinates(uv);
      var country     = countryFromCountryCode(countryCode);

      return country;
    }
  };

  var placeCountryLabel = function(x, y) {
    var country = countryFromScreenCoordinates(x, y);
    if (country) {
      if (!hoveredCountry || hoveredCountry.code != country.code) {
        hoveredCountry = country;
        countryLabelText.html(hoveredCountry.name);
        countryLabel.show();
      }
    } else {
      hoveredCountry = null;
      countryLabelText.html("");
      countryLabel.hide();
    }

    if (hoveredCountry) {
      countryLabel.css({'left': x + 30, 'top': y - 20});
    }
  };

  /* event handlers */

  var mouseDownHandler = function(event) {
    event.preventDefault();

    mouseOnDown.x = - event.clientX;
    mouseOnDown.y = event.clientY;

    targetOnDown.x = target.x;
    targetOnDown.y = target.y;

    mouseDown       = true;
    autospinEnabled = false;
  };

  var mouseUpHandler = function() {
    mouseDown = false;

    if (dragging == false) {
      var country = countryFromScreenCoordinates(event.clientX, event.clientY);
      if (country) {
        $('body').trigger('musicmap:globe:click', country);
      }
    }

    dragging = false;
  };

  var mouseMoveHandler = function(event) {
    if (mouseDown) {
      dragging = true;

      var dx       = mouseOnDown.x - (-event.clientX);
      var dy       = mouseOnDown.y - event.clientY;
      var d        = Math.sqrt(dx*dx + dy*dy);
      var zoomDamp = distance / 1000;
      var piHalf   = Math.PI / 2;

      mouse.x = - event.clientX;
      mouse.y = event.clientY;

      target.x = targetOnDown.x + (mouse.x - mouseOnDown.x) * 0.01 * zoomDamp;
      target.y = targetOnDown.y + (mouse.y - mouseOnDown.y) * 0.01 * zoomDamp;

      target.y = target.y > piHalf ? piHalf : target.y;
      target.y = target.y < - piHalf ? - piHalf : target.y;
    }

    placeCountryLabel(event.clientX, event.clientY);
  };

  var mouseWheelHandler = function(event) {
    event.preventDefault();
    zoom(event.originalEvent.wheelDeltaY * 0.3);
  };

  var handleContextLost = function(event) {
    event.preventDefault();
    cancelAnimationFrame(requestId);
  };

  var handleContextRestored = function(event) {
    initialize(el);
  };

  var resizeHandler = function() {
    width  = el.width();
    height = el.height();
    camera.aspect = width / height;
    camera.updateProjectionMatrix();
    renderer.setSize(width, height);
  };

  /* helper methods */

  var marker = function(point) {
    var markerGeometry = new THREE.SphereGeometry(5, 50, 50);
    var markerMaterial = new THREE.MeshBasicMaterial({color: 0x000000});
    var marker         = new THREE.Mesh(markerGeometry, markerMaterial);

    marker.position = point;

    globe.add(marker);

    return marker;
  };

  var loadLineMesh = function(loader, material) {
    var coords = loader().children[0].children[0].attributes.Vertex.elements;
    var lines = [];
    for (i=0; i<coords.length; i+=3) {
      lines.push(new THREE.Vector3(coords[i], coords[i+1], coords[i+2]));
    }
    lines = spherizeLines(lines, 1/64);
    var lineGeo = new THREE.Geometry();
    for (var i=0; i<lines.length; i++) {
      lineGeo.vertices.push(lines[i]);
    }
    var lineMesh = new THREE.Line(lineGeo, material);
    lineMesh.type = THREE.Lines;
    lineMesh.scale.x = lineMesh.scale.y = lineMesh.scale.z = 0.00003155;
    lineMesh.rotation.x = -Math.PI/2;
    lineMesh.rotation.z = Math.PI;
    lineMesh.matrixAutoUpdate = false;
    lineMesh.updateMatrix();
    return lineMesh;
  };

  var loadTriMesh = function(loader, material) {
    var coords = loader().children[0].children[0].attributes.Vertex.elements;
    var lineGeo = new THREE.Geometry();
    var i = 0;
    var lines = [];
    for (i=0; i<coords.length; i+=3) {
      lines.push(new THREE.Vector3(coords[i], coords[i+1], coords[i+2]));
    }
    lines = spherizeTris(lines, 1/64);
    for (i=0; i<lines.length; i++) {
      lineGeo.vertices.push(lines[i]);
    }
    for (i=0; i<lines.length; i+=3) {
      lineGeo.faces.push(new THREE.Face3(i, i+1, i+2, null, null));
    }
    lineGeo.computeFaceNormals();
    lineGeo.computeVertexNormals();
    lineGeo.computeBoundingSphere();
    var lineMesh = new THREE.Mesh(lineGeo, material);
    lineMesh.type = THREE.Triangles;
    lineMesh.scale.x = lineMesh.scale.y = lineMesh.scale.z = 0.0000315;
    lineMesh.rotation.x = -Math.PI/2;
    lineMesh.rotation.z = Math.PI;
    lineMesh.matrixAutoUpdate = false;
    lineMesh.doubleSided = true;
    lineMesh.updateMatrix();
    return lineMesh;
  };

  var splitTri = function(u, v, w, maxLength) {
    var d, parts, plen, nd, tris, i;
    var tmpV0 = new THREE.Vector3();
    var tmpV1 = new THREE.Vector3();
    var tmpV2 = new THREE.Vector3();
    d = tmpV0.subVectors(v, u);
    var len = d.length();
    if (len > maxLength*1.1) {
      parts = Math.max(2, Math.ceil(len / maxLength));
      plen = len / parts;
      nd = d.normalize();
      tris = [];
      for (i=0; i<parts; i++) {
        tmpV1.copy(nd);
        tmpV1.multiplyScalar(plen*i);
        tmpV1.add(u);
        tmpV2.copy(nd);
        tmpV2.multiplyScalar(plen*(i+1));
        tmpV2.add(u)
        tris = tris.concat(splitTri(tmpV1.clone(), tmpV2.clone(), w, maxLength));
      }
      return tris;
    } else if (d.subVectors(w,v).length() > maxLength*1.1) {
      return splitTri(v, w, u, maxLength);
    } else if (d.subVectors(w,u).length() > maxLength*1.1) {
      return splitTri(w, u, v, maxLength);
    }

    return [u,v,w];
  };

  var splitLine = function(u, v, maxLength) {
    var d, parts, plen, nd, lines, i;
    var tmpV0 = new THREE.Vector3();
    var tmpV1 = new THREE.Vector3();
    var tmpV2 = new THREE.Vector3();
    d = tmpV0.subVectors(v, u);
    var len = d.length();
    if (len > maxLength*1.1) {
      parts = Math.max(2, Math.ceil(len / maxLength));
      plen = len / parts;
      nd = d.normalize();
      lines = [];
      for (i=0; i<parts; i++) {
        tmpV1.copy(nd);
        tmpV1.multiplyScalar(plen*i);
        tmpV1.add(u);
        tmpV2.copy(nd);
        tmpV2.multiplyScalar(plen*(i+1));
        tmpV2.add(u)
        lines.push(tmpV1.clone(), tmpV2.clone());
      }
      return lines;
    }
    return [u,v];
  };

  var spherizeVertsInPlace = function(verts, radius) {
    var t = verts;
    for (var i=0; i<t.length; i++) {
      t[i].multiplyScalar(radius/t[i].length());
    }
    return t;
  };

  var spherizeTris = function(triVerts, maxLength) {
    var newVerts = [];
    var t = triVerts;
    var radius = t[0].length();
    maxLength *= 2*Math.PI*radius;
    for (var i=0; i<t.length; i+=3) {
      var arr = splitTri(t[i], t[i+1], t[i+2], maxLength);
      spherizeVertsInPlace(arr, radius);
      for (var j=0; j<arr.length; j++) {
        newVerts.push(arr[j]);
      }
    }
    return newVerts;
  };

  var spherizeLines = function(lineVerts, maxLength) {
    var newVerts = [];
    var t = lineVerts;
    var radius = t[0].length();
    maxLength *= 2*Math.PI*radius;
    for (var i=0; i<t.length; i+=2) {
      var arr = splitLine(t[i], t[i+1], maxLength);
      spherizeVertsInPlace(arr, radius);
      for (var j=0; j<arr.length; j++) {
        newVerts.push(arr[j]);
      }
    }
    return newVerts;
  };

  /* public interface */

  return {
    initialize: initialize,
    autospin: autospin
  };

})(jQuery);
