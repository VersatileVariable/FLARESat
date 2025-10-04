// Earth creation and management
function createEarth() {
    const textureLoader = new THREE.TextureLoader();
    
    // Create Earth sphere
    const earthGeometry = new THREE.SphereGeometry(5, 64, 64);
    
    // Load textures
    const earthMaterial = new THREE.MeshPhongMaterial({
        map: textureLoader.load('https://raw.githubusercontent.com/mrdoob/three.js/dev/examples/textures/planets/earth_atmos_2048.jpg'),
        bumpMap: textureLoader.load('https://raw.githubusercontent.com/mrdoob/three.js/dev/examples/textures/planets/earth_normal_2048.jpg'),
        bumpScale: 0.05,
        specularMap: textureLoader.load('https://raw.githubusercontent.com/mrdoob/three.js/dev/examples/textures/planets/earth_specular_2048.jpg'),
        specular: new THREE.Color('grey'),
        shininess: 0.5
    });

    const earth = new THREE.Mesh(earthGeometry, earthMaterial);

    // Add clouds
    const cloudGeometry = new THREE.SphereGeometry(5.1, 64, 64);
    const cloudMaterial = new THREE.MeshPhongMaterial({
        map: textureLoader.load('https://raw.githubusercontent.com/mrdoob/three.js/dev/examples/textures/planets/earth_clouds_1024.png'),
        transparent: true,
        opacity: 0.4
    });

    const clouds = new THREE.Mesh(cloudGeometry, cloudMaterial);
    earth.add(clouds);

    // Add atmosphere glow
    const atmosphereGeometry = new THREE.SphereGeometry(5.2, 64, 64);
    const atmosphereMaterial = new THREE.ShaderMaterial({
        transparent: true,
        uniforms: {
            coefficient: { value: 0.1 },
            power: { value: 2.0 },
            glowColor: { value: new THREE.Color(0x93e6ff) }
        },
        vertexShader: `
            varying vec3 vNormal;
            void main() {
                vNormal = normalize(normalMatrix * normal);
                gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
            }
        `,
        fragmentShader: `
            uniform vec3 glowColor;
            uniform float coefficient;
            uniform float power;
            varying vec3 vNormal;
            void main() {
                float intensity = pow(coefficient - dot(vNormal, vec3(0.0, 0.0, 1.0)), power);
                gl_FragColor = vec4(glowColor, intensity);
            }
        `,
        side: THREE.BackSide
    });

    const atmosphere = new THREE.Mesh(atmosphereGeometry, atmosphereMaterial);
    earth.add(atmosphere);

    // Add night lights
    const nightGeometry = new THREE.SphereGeometry(5.01, 64, 64);
    const nightMaterial = new THREE.MeshBasicMaterial({
        map: textureLoader.load('https://raw.githubusercontent.com/mrdoob/three.js/dev/examples/textures/planets/earth_lights_2048.png'),
        transparent: true,
        opacity: 0.5,
        blending: THREE.AdditiveBlending
    });

    const nightSide = new THREE.Mesh(nightGeometry, nightMaterial);
    earth.add(nightSide);

    // Position earth lower in the scene
    earth.position.set(0, -5, 0);
    
    // Add rotation animation
    earth.userData.animate = function(delta) {
        if (!isDragging) {
            earth.rotation.y += 0.0005;
        }
        clouds.rotation.y += 0.0001;
        nightSide.rotation.y = earth.rotation.y;
    };

    return earth;
}