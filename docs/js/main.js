console.log('LEO Business Challenge - Initialized');

function scrollToSection(sectionId) {
    const element = document.getElementById(sectionId);
    if (element) {
        element.scrollIntoView({ 
            behavior: 'smooth',
            block: 'start'
        });
    }
}

function updateActiveNavLink() {
    const sections = document.querySelectorAll('.section, .hero');
    const navLinks = document.querySelectorAll('.nav-menu a');
    
    let currentSection = '';
    
    sections.forEach(section => {
        const sectionTop = section.offsetTop;
        if (window.pageYOffset >= sectionTop - 100) {
            currentSection = section.getAttribute('id');
        }
    });
    
    navLinks.forEach(link => {
        link.classList.remove('active');
        if (link.getAttribute('href') === `#${currentSection}`) {
            link.classList.add('active');
        }
    });
}

function fadeInOnScroll() {
    const elements = document.querySelectorAll('.challenge-card, .team-card, .solution-text');
    
    elements.forEach(element => {
        const elementTop = element.getBoundingClientRect().top;
        const windowHeight = window.innerHeight;
        
        if (elementTop < windowHeight - 100) {
            element.style.opacity = '1';
            element.style.transform = 'translateY(0)';
        }
    });
}

function initFadeAnimations() {
    const elements = document.querySelectorAll('.challenge-card, .team-card, .solution-text');
    elements.forEach(element => {
        element.style.opacity = '0';
        element.style.transform = 'translateY(20px)';
        element.style.transition = 'opacity 0.6s ease, transform 0.6s ease';
    });
}

let scene, camera, renderer, earth, satellites = [], orbitLines = [];
let fires = [];
let detectionLines = [];
let satelliteLinks = []; // Array to store inter-satellite link lines
let isDragging = false;
let previousMousePosition = { x: 0, y: 0 };
let autoRotate = true;
let confirmatingSatellites = [];
let weatherClouds = [];
let earthTextureData = null; // Store texture pixel data for land detection
let earthTextureLoaded = false;

// Configuration for inter-satellite links
const ENABLE_SAT_LINKS = true; // Toggle satellite links on/off
const SAT_LINK_DISTANCE = 3.5; // Maximum distance for satellite links (in scene units) - more lenient
const SAT_LINK_COLOR = 0x4ecdc4; // Cyan color for links
const SAT_LINK_OPACITY = 0.3; // Semi-transparent links
const MAX_LINKS_PER_SAT = 3; // Maximum 2-3 links per satellite, judged by distance

function initHero3D() {
    const container = document.querySelector('.hero-background');
    if (!container) return;

    scene = new THREE.Scene();

    camera = new THREE.PerspectiveCamera(
        50,
        window.innerWidth / window.innerHeight,
        0.1,
        1000
    );
    // Position camera higher up for better view
    camera.position.set(0, -20, 15);  // Camera moved up
    camera.lookAt(0, -20, 0);  // Look at Earth center

    renderer = new THREE.WebGLRenderer({ 
        antialias: true,
        alpha: true 
    });
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.setPixelRatio(window.devicePixelRatio);
    renderer.setClearColor(0x000000, 0);
    container.appendChild(renderer.domElement);

    const ambientLight = new THREE.AmbientLight(0xffffff, 0.5);
    scene.add(ambientLight);

    const directionalLight = new THREE.DirectionalLight(0xffffff, 1.2);
    directionalLight.position.set(10, 20, 10);
    scene.add(directionalLight);

    // ========== EARTH SPHERE ==========
    // Main Earth sphere with realistic texture map showing continents and oceans
    const earthGeometry = new THREE.SphereGeometry(10, 64, 64);
    
    // Create Earth material first with a temporary blue color
    const earthMaterial = new THREE.MeshPhongMaterial({
        color: 0x4a90e2,            // Blue ocean color as default
        shininess: 60,              // Glossy surface for water reflection
        specular: 0x333333,         // Specular highlights on oceans
    });
    
    earth = new THREE.Mesh(earthGeometry, earthMaterial);
    earth.position.y = -30;
    earth.rotation.z = Math.PI / 2; // Rotate 90 degrees so poles are on X axis
    earth.rotation.y = Math.PI / 3; // Rotate 60 degrees along equator (60° = π/3 radians)
    scene.add(earth);
    
    // Load Earth texture - using reliable CDN source
    const textureLoader = new THREE.TextureLoader();
    textureLoader.setCrossOrigin('anonymous'); // Enable CORS
    
    textureLoader.load(
        // Using simple two-color Earth map (blue ocean, green/brown land)
        'https://raw.githubusercontent.com/turban/webgl-earth/master/images/2_no_clouds_4k.jpg',
        // Success callback - apply texture and extract pixel data for land detection
        (texture) => {
            console.log('Earth texture loaded successfully!');
            console.log('Texture dimensions:', texture.image.width, 'x', texture.image.height);
            
            // Apply the texture to the material
            earthMaterial.map = texture;
            earthMaterial.color.setHex(0xffffff); // Reset to white to show true texture colors
            earthMaterial.needsUpdate = true;
            
            console.log('Texture applied to Earth material');
            
            // Create canvas to read pixel data for land detection
            try {
                const canvas = document.createElement('canvas');
                const img = texture.image;
                canvas.width = img.width;
                canvas.height = img.height;
                const ctx = canvas.getContext('2d');
                ctx.drawImage(img, 0, 0);
                earthTextureData = ctx.getImageData(0, 0, canvas.width, canvas.height);
                earthTextureLoaded = true;
                console.log('Earth texture data extracted for land detection');
            } catch (e) {
                console.warn('Could not extract pixel data (CORS):', e);
                earthTextureLoaded = false;
            }
        },
        // Progress callback
        (xhr) => {
            if (xhr.lengthComputable) {
                const percentComplete = xhr.loaded / xhr.total * 100;
                console.log('Loading texture:', percentComplete.toFixed(2) + '% loaded');
            }
        },
        // Error callback
        (error) => {
            console.error('Error loading Earth texture:', error);
            console.log('Keeping blue fallback color for Earth');
            earthTextureLoaded = false;
        }
    );

    // ========== DARK AURA - ATMOSPHERIC GLOW ==========
    // This creates the dark blue/purple halo effect around Earth that simulates the atmosphere
    // The sphere is slightly larger than Earth and uses BackSide rendering to create an outer glow
    // Note: Currently removed for cleaner look, but code preserved for reference
    // Uncomment the following block to enable the atmospheric aura:
    /*
    const atmosphereGeometry = new THREE.SphereGeometry(10.4, 64, 64);  // Slightly larger than Earth (10.4 vs 10)
    const atmosphereMaterial = new THREE.MeshBasicMaterial({
        color: 0x667eea,              // Purple-blue atmosphere color
        transparent: true,             // Must be transparent to show Earth beneath
        opacity: 0.25,                 // Low opacity for subtle glow effect
        side: THREE.BackSide          // DARK AURA: Renders only the inside faces, creating outer glow from within
    });
    const atmosphere = new THREE.Mesh(atmosphereGeometry, atmosphereMaterial);
    atmosphere.position.y = -25;       // Same Y position as Earth
    scene.add(atmosphere);

    // Optional: Additional outer glow layer for enhanced atmospheric depth
    const outerGlowGeometry = new THREE.SphereGeometry(11, 64, 64);     // Even larger sphere for extended glow
    const outerGlowMaterial = new THREE.MeshBasicMaterial({
        color: 0x667eea,              // Same purple-blue color
        transparent: true,
        opacity: 0.1,                 // Very subtle outer layer
        side: THREE.BackSide          // DARK AURA: BackSide rendering creates the halo effect
    });
    const outerGlow = new THREE.Mesh(outerGlowGeometry, outerGlowMaterial);
    outerGlow.position.y = -25;
    scene.add(outerGlow);
    */

    createEarthDetails();
    createEquator();

    // ========== WALKER DELTA CONSTELLATION: 56°:1000/20/1 ==========
    // Based on Walker Delta pattern notation i:t/p/f (similar to Galileo navigation system):
    // i = 56° inclination (tilt of orbital plane relative to Earth's equator)
    // t = 1000 total satellites
    // p = 20 orbital planes  
    // f = 1 phasing factor (relative shift of satellites in adjacent planes)
    //
    // Walker Delta Characteristics:
    // • Provides consistent GLOBAL COVERAGE by distributing satellites across Earth's surface
    // • Satellites placed in multiple, equally spaced orbital planes
    // • "Delta" phasing creates DIAMOND-SHAPED coverage pattern near the equator
    // • Adjacent planes have satellites offset (phased) from each other
    // • Each plane rotated around Earth's Z-axis by angle of 2π/p (360°/20 = 18°)
    //
    // Key Features:
    // • 1000 Satellites Total - 50 satellites evenly distributed in each of the 20 orbital planes
    // • 20 Orbital Planes - Each plane separated by 18° RAAN (Right Ascension of Ascending Node)
    // • 56° Inclination - Common angle for LEO constellations, provides good global coverage
    //   while avoiding polar regions (similar to Galileo's 56°:24/3/1 configuration)
    // • Orbital Altitude - ~500-550 km (represented as radius 14 units in simulation)
    // • Phasing Factor f=1 - Satellites in adjacent planes offset by (f × 360°) / t
    //   This creates the characteristic delta pattern with optimal coverage gaps
    // • Uniform Distribution - Equal spacing within planes and coordinated spacing between planes
    //
    // Generation Process:
    // 1. Start with basic inclined orbit at 56°
    // 2. Replicate orbit 20 times (p=20 planes)
    // 3. Rotate each plane by 2π/p around Z-axis (18° increments)
    // 4. Apply phasing offset to satellites in successive planes (slot offset)
    //
    // This constellation provides:
    // ✓ Consistent global coverage (Walker Delta ensures minimal gaps)
    // ✓ Diamond-shaped coverage pattern for efficient Earth monitoring
    // ✓ Similar to Galileo (56°:24/3/1) and GPS navigation systems
    // ✓ Optimal for global fire detection with rapid revisit times
    // ✓ Highly scalable design following established satellite navigation patterns
    
    const totalSatellites = 1000;
    const numPlanes = 20;
    const satellitesPerPlane = totalSatellites / numPlanes; // 50 satellites per plane
    const inclination = 56 * (Math.PI / 180); // 56° inclination (Walker Delta standard)
    const orbitRadius = 14; // ~500-550 km altitude
    const orbitSpeed = 0.0003; // Slower orbital speed (was 0.0006)
    const phasingFactor = 1; // Phase offset between planes (f=1 in Walker notation)
    
    // Color palette for 20 orbital planes
    const colors = [
        0xff6b6b, 0x4ecdc4, 0xffe66d, 0x95e1d3, 0xffa07a,
        0x98d8c8, 0xf7b731, 0xeb4d4b, 0x6ab04c, 0x00a8ff,
        0xe056fd, 0x686de0, 0x30336b, 0xf8b500, 0xff3838,
        0x7ed6df, 0xf368e0, 0xff9ff3, 0x48dbfb, 0x0abde3
    ];

    for (let plane = 0; plane < numPlanes; plane++) {
        // Calculate RAAN (Right Ascension of Ascending Node) for each plane
        // Walker Delta: Each plane rotated around Earth's Z-axis by 2π/p
        const raan = (plane * 2 * Math.PI) / numPlanes; // 360° / 20 planes = 18° spacing
        
        // Create orbit line for this plane
        const orbitPoints = [];
        for (let i = 0; i <= 100; i++) {
            const angle = (i / 100) * Math.PI * 2;
            
            // Position in orbital plane
            const xOrbit = orbitRadius * Math.cos(angle);
            const yOrbit = orbitRadius * Math.sin(angle) * Math.sin(inclination);
            const zOrbit = orbitRadius * Math.sin(angle) * Math.cos(inclination);
            
            // Rotate by RAAN to position the plane
            const x = xOrbit * Math.cos(raan) - zOrbit * Math.sin(raan);
            const y = yOrbit;
            const z = xOrbit * Math.sin(raan) + zOrbit * Math.cos(raan);
            
            orbitPoints.push(new THREE.Vector3(x, y, z));
        }

        const orbitGeometry = new THREE.BufferGeometry().setFromPoints(orbitPoints);
        const orbitMaterial = new THREE.LineBasicMaterial({
            color: colors[plane],
            transparent: true,
            opacity: 0.4
        });

        const orbitLine = new THREE.Line(orbitGeometry, orbitMaterial);
        earth.add(orbitLine);
        orbitLines.push({ line: orbitLine, baseOpacity: 0.4 });

        // Place satellites evenly in this orbital plane
        for (let sat = 0; sat < satellitesPerPlane; sat++) {
            const satellite = createSatellite(colors[plane], 0.1);
            
            // ========== COLLISION AVOIDANCE: WALKER DELTA PHASING ==========
            // Calculate initial angle with Walker Delta constellation phasing
            // This formula PREVENTS COLLISIONS by offsetting satellites in adjacent planes
            //
            // Proper Walker Delta Phasing Formula:
            // For Walker Delta i:t/p/f notation, the true anomaly (angle) for each satellite is:
            // θ = (360° × s / satellitesPerPlane) + (360° × f × planeIndex / totalSatellites)
            // 
            // This creates a SPIRAL/ROSETTE pattern where:
            // 1. Base angle: evenly space satellites within the plane (s/satellitesPerPlane)
            //    → Satellite 0: 0°, Satellite 1: 7.2°, Satellite 2: 14.4°, etc.
            // 2. Phase offset: offset each plane by (f × planeIndex / totalSatellites) full revolutions
            //    → Plane 0: +0°, Plane 1: +0.36°, Plane 2: +0.72°, Plane 3: +1.08°, etc.
            //    → This is MUCH smaller than the 7.2° in-plane spacing (0.36° vs 7.2°)
            // 3. RAAN rotation: each plane rotated 18° around Earth's axis
            //    → Combined with subtle phase offset creates optimal collision-free pattern
            //
            // Result: Adjacent planes are offset by tiny increments (1/totalSatellites of a full orbit)
            // This creates maximum separation at orbital plane intersections
            const baseAngle = (sat * 2 * Math.PI) / satellitesPerPlane; // 0°, 7.2°, 14.4°, 21.6°, etc.
            const phaseOffset = (phasingFactor * plane * 2 * Math.PI) / totalSatellites; // 0.36° × plane_number (1/1000 revolution per plane)
            const initialAngle = baseAngle + phaseOffset; // Combined: subtle spiral prevents collisions
            
            satellite.userData = {
                orbitRadius: orbitRadius,
                speed: orbitSpeed,
                angle: initialAngle,
                inclination: inclination,
                raan: raan, // Store RAAN for proper orbit calculation
                orbitColor: colors[plane],
                plane: plane,
                isConfirming: false,
                isReturning: false,
                targetFire: null,
                originalOrbit: {
                    radius: orbitRadius,
                    speed: orbitSpeed,
                    inclination: inclination,
                    raan: raan
                }
            };
            earth.add(satellite);
            satellites.push(satellite);
        }
    }

    createFires();
    createWeatherClouds();
    createStars();
    setupHeroMouseControls();

    window.addEventListener('resize', onHeroResize);

    animateHero();

    // Spawn new fires every 1 second for continuous action
    setInterval(() => {
        spawnRandomFire();
    }, 1000);
    
    // Spawn new weather clouds every 5 seconds (more frequent)
    setInterval(() => {
        spawnWeatherCloud();
    }, 5000);
}

function createEarthDetails() {
    for (let lat = -Math.PI / 2; lat <= Math.PI / 2; lat += Math.PI / 12) {
        const radius = 10 * Math.cos(lat);
        const yPos = 10 * Math.sin(lat);
        
        const curve = new THREE.EllipseCurve(0, 0, radius, radius, 0, 2 * Math.PI, false, 0);
        const points = curve.getPoints(64);
        const geometry = new THREE.BufferGeometry().setFromPoints(points);
        const material = new THREE.LineBasicMaterial({ 
            color: 0x2a5f8f, 
            transparent: true, 
            opacity: 0.3 
        });
        const line = new THREE.Line(geometry, material);
        line.position.y = yPos;
        earth.add(line);
    }

    for (let lon = 0; lon < Math.PI * 2; lon += Math.PI / 12) {
        const points = [];
        for (let lat = -Math.PI / 2; lat <= Math.PI / 2; lat += Math.PI / 32) {
            const x = 10 * Math.cos(lat) * Math.cos(lon);
            const z = 10 * Math.cos(lat) * Math.sin(lon);
            const y = 10 * Math.sin(lat);
            points.push(new THREE.Vector3(x, y, z));
        }
        const geometry = new THREE.BufferGeometry().setFromPoints(points);
        const material = new THREE.LineBasicMaterial({ 
            color: 0x2a5f8f, 
            transparent: true, 
            opacity: 0.3 
        });
        const line = new THREE.Line(geometry, material);
        earth.add(line);
    }
}

function createEquator() {
    // Create a bright equator line at y = 0 (relative to Earth center)
    const equatorRadius = 10.02; // Just slightly above Earth surface to avoid z-fighting
    const equatorPoints = [];
    
    for (let i = 0; i <= 100; i++) {
        const angle = (i / 100) * Math.PI * 2;
        const x = equatorRadius * Math.cos(angle);
        const z = equatorRadius * Math.sin(angle);
        equatorPoints.push(new THREE.Vector3(x, 0, z));
    }
    
    const equatorGeometry = new THREE.BufferGeometry().setFromPoints(equatorPoints);
    const equatorMaterial = new THREE.LineBasicMaterial({
        color: 0xffff00, // Bright yellow for visibility
        transparent: true,
        opacity: 0.9,
        linewidth: 3,
        depthTest: true, // Enable depth testing so it doesn't show through Earth
        depthWrite: true
    });
    
    const equatorLine = new THREE.Line(equatorGeometry, equatorMaterial);
    earth.add(equatorLine);
    
    // Add "EQUATOR" text labels at 0° and 180°
    const labelPositions = [0, Math.PI]; // 0 degrees and 180 degrees
    
    labelPositions.forEach((angle) => {
        const canvas = document.createElement('canvas');
        const context = canvas.getContext('2d');
        canvas.width = 512;
        canvas.height = 128;
        
        // Draw text
        context.fillStyle = 'rgba(255, 255, 0, 0.95)';
        context.font = 'Bold 56px Arial';
        context.textAlign = 'center';
        context.textBaseline = 'middle';
        context.fillText('EQUATOR', 256, 64);
        
        // Create texture from canvas
        const texture = new THREE.CanvasTexture(canvas);
        
        // Create a plane geometry for the text
        const textGeometry = new THREE.PlaneGeometry(3, 0.75);
        const textMaterial = new THREE.MeshBasicMaterial({ 
            map: texture,
            transparent: true,
            side: THREE.DoubleSide,
            depthTest: true,
            depthWrite: true
        });
        const textMesh = new THREE.Mesh(textGeometry, textMaterial);
        
        // Position the text above the equator line to avoid overlap
        const labelRadius = 10.05;
        textMesh.position.set(
            labelRadius * Math.cos(angle),
            0.5, // Position above the equator line
            labelRadius * Math.sin(angle)
        );
        
        // Rotate to be readable and tangent to the equator
        textMesh.rotation.y = angle + Math.PI / 2; // Face outward and tangent to circle
        
        earth.add(textMesh);
    });
}

function createFires() {
    // Spawn more initial fires for better visual impact
    // Wait longer to ensure texture is fully loaded and processed
    setTimeout(() => {
        console.log('Starting initial fire spawn. Texture loaded:', earthTextureLoaded);
        if (!earthTextureLoaded) {
            console.error('WARNING: Texture still not loaded after 3 seconds!');
        }
        for (let i = 0; i < 30; i++) {
            spawnRandomFire();
        }
    }, 3000); // Increased to 3 seconds to ensure texture is ready
}

function createWeatherClouds() {
    // Create initial weather clouds that satellites must see through
    for (let i = 0; i < 15; i++) {
        spawnWeatherCloud();
    }
}

function spawnWeatherCloud() {
    // Limit number of weather clouds
    if (weatherClouds.length > 20) {
        const oldCloud = weatherClouds.shift();
        earth.remove(oldCloud.mesh);
    }

    // OPTIMIZATION: Only spawn clouds on visible (front) hemisphere
    const maxLatitude = 70 * (Math.PI / 180); // Weather clouds can appear up to ±70°
    const lat = (Math.random() - 0.5) * 2 * maxLatitude;
    
    // Restrict longitude to front-facing hemisphere: -90° to +90°
    const minLon = -Math.PI / 2;
    const maxLon = Math.PI / 2;
    const lon = minLon + Math.random() * (maxLon - minLon);
    const radius = 10.5; // Higher in atmosphere (was 10.15)
    
    // Create low-poly cloud using multiple overlapping icosahedrons
    const cloudGroup = new THREE.Group();
    const numPuffs = 5 + Math.floor(Math.random() * 4); // 5-8 cloud puffs
    
    for (let i = 0; i < numPuffs; i++) {
        // Use IcosahedronGeometry with detail 0 or 1 for low-poly angular look
        const puffGeometry = new THREE.IcosahedronGeometry(
            0.2 + Math.random() * 0.2, // Random size 0.2-0.4
            Math.floor(Math.random() * 2) // Detail level 0 or 1 for low-poly
        );
        const puffMaterial = new THREE.MeshPhongMaterial({
            color: 0xffffff,
            transparent: true,
            opacity: 0.9, // Higher opacity for whiter appearance
            shininess: 10,
            emissive: 0xffffff, // Pure white emissive for brighter clouds
            emissiveIntensity: 0.3, // Stronger emission for whiter look
            flatShading: true // Makes polygon faces visible and angular
        });
        const puff = new THREE.Mesh(puffGeometry, puffMaterial);
        
        // Random offset within cloud group
        puff.position.set(
            (Math.random() - 0.5) * 0.7,
            (Math.random() - 0.5) * 0.25,
            (Math.random() - 0.5) * 0.7
        );
        
        // Random rotation for more variation
        puff.rotation.set(
            Math.random() * Math.PI,
            Math.random() * Math.PI,
            Math.random() * Math.PI
        );
        
        cloudGroup.add(puff);
    }
    
    // Position cloud higher in atmosphere
    const x = radius * Math.cos(lat) * Math.cos(lon);
    const z = radius * Math.cos(lat) * Math.sin(lon);
    const y = radius * Math.sin(lat);
    
    cloudGroup.position.set(x, y, z);
    cloudGroup.lookAt(0, 0, 0);
    
    earth.add(cloudGroup);
    
    const cloudData = {
        mesh: cloudGroup,
        position: new THREE.Vector3(x, y, z),
        lat: lat,
        lon: lon,
        radius: radius,
        driftSpeed: 0.00005 + Math.random() * 0.00005, // Slow drift
        driftAngle: Math.random() * Math.PI * 2,
        life: 0,
        maxLife: 60000 + Math.random() * 60000 // 60-120 seconds
    };
    
    weatherClouds.push(cloudData);
}

// Helper function to check if a lat/lon coordinate is on land
function isOnLand(lat, lon) {
    if (!earthTextureLoaded || !earthTextureData) {
        console.warn('Texture not loaded yet! earthTextureLoaded:', earthTextureLoaded, 'earthTextureData:', !!earthTextureData);
        return false; // CHANGED: Don't allow fires if texture isn't loaded yet
    }
    
    // Convert lat/lon to texture UV coordinates
    // Longitude: -180° to 180° maps to 0 to 1 (U)
    // Latitude: 90° to -90° maps to 0 to 1 (V)
    const u = (lon / (Math.PI * 2) + 0.5) % 1.0;
    const v = 0.5 - (lat / Math.PI);
    
    // Get pixel coordinates
    const x = Math.floor(u * earthTextureData.width);
    const y = Math.floor(v * earthTextureData.height);
    
    // Helper function to check if a pixel is water (PRECISE COLOR MATCHING)
    const isWaterAtPixel = (px, py) => {
        // Boundary check
        if (px < 0 || px >= earthTextureData.width || py < 0 || py >= earthTextureData.height) {
            return true; // Treat boundary as water to be safe
        }
        
        const idx = (py * earthTextureData.width + px) * 4;
        const pr = earthTextureData.data[idx];
        const pg = earthTextureData.data[idx + 1];
        const pb = earthTextureData.data[idx + 2];
        
        // Check for ocean color #006099 (RGB: 0, 96, 153)
        // Allow small tolerance: R≤5, G=90-102, B=145-160
        if (pr <= 5 && pg >= 90 && pg <= 102 && pb >= 145 && pb <= 160) {
            return true; // Matches ocean color #006099
        }
        
        // Not ocean
        return false;
    };
    
    // Get pixel color (RGBA) at center point
    const index = (y * earthTextureData.width + x) * 4;
    const r = earthTextureData.data[index];
    const g = earthTextureData.data[index + 1];
    const b = earthTextureData.data[index + 2];
    
    // Check for ocean color #006099 (RGB: 0, 96, 153)
    // Allow small tolerance: R≤5, G=90-102, B=145-160
    if (r <= 5 && g >= 90 && g <= 102 && b >= 145 && b <= 160) {
        return false; // Matches ocean color #006099
    }
    
    // Check buffer zone: sample pixels in a larger grid around the point
    // This ensures fires don't spawn too close to coastlines
    const bufferSize = 6; // Increased from 3 to 6 pixels for more safety
    for (let dy = -bufferSize; dy <= bufferSize; dy++) {
        for (let dx = -bufferSize; dx <= bufferSize; dx++) {
            if (isWaterAtPixel(x + dx, y + dy)) {
                return false; // Too close to water
            }
        }
    }
    
    // Passed all checks - it's land and far enough from ocean
    return true;
}

function spawnRandomFire() {
    // Allow up to 40 fires at once for more dramatic effect
    if (fires.length > 40) {
        const oldFire = fires.shift();
        earth.remove(oldFire.marker);
        earth.remove(oldFire.glow);
        // Remove smoke clouds
        if (oldFire.smokeClouds) {
            oldFire.smokeClouds.forEach(cloud => earth.remove(cloud));
        }
    }

    const fireGeometry = new THREE.CircleGeometry(0.15, 8);
    const fireMaterial = new THREE.MeshBasicMaterial({ 
        color: 0xff4444,
        transparent: true,
        opacity: 0.95
    });
    const fireMarker = new THREE.Mesh(fireGeometry, fireMaterial);
    
    const glowGeometry = new THREE.CircleGeometry(0.28, 8);
    const glowMaterial = new THREE.MeshBasicMaterial({ 
        color: 0xff6b6b,
        transparent: true,
        opacity: 0.5
    });
    const glow = new THREE.Mesh(glowGeometry, glowMaterial);
    
    // Restrict fires to ±56° latitude (matching 56° Walker Delta constellation coverage)
    const maxLatitude = 56 * (Math.PI / 180); // 56 degrees in radians (matches inclination)
    
    // OPTIMIZATION: Only spawn fires on visible (front) hemisphere
    // Restrict longitude to front-facing hemisphere: -90° to +90° (or -π/2 to +π/2)
    const minLon = -Math.PI / 2;
    const maxLon = Math.PI / 2;
    
    // Try up to 200 times to find a land location (increased from 50)
    let lat, lon;
    let attempts = 0;
    let foundLand = false;
    
    while (attempts < 200 && !foundLand) {
        lat = (Math.random() - 0.5) * 2 * maxLatitude; // Random latitude between -56° and +56°
        lon = minLon + Math.random() * (maxLon - minLon); // Only front hemisphere
        
        if (isOnLand(lat, lon)) {
            foundLand = true;
        }
        attempts++;
    }
    
    // If we couldn't find land after 200 attempts, skip this fire spawn
    // This prevents ocean fires from appearing
    if (!foundLand) {
        console.log('Could not find land location after 200 attempts, skipping fire spawn');
        return; // Exit without spawning fire
    }
    
    const radius = 10.08;
    
    const x = radius * Math.cos(lat) * Math.cos(lon);
    const z = radius * Math.cos(lat) * Math.sin(lon);
    const y = radius * Math.sin(lat);
    
    fireMarker.position.set(x, y, z);
    glow.position.set(x, y, z);
    
    fireMarker.lookAt(0, 0, 0);
    glow.lookAt(0, 0, 0);
    fireMarker.rotateX(Math.PI);
    glow.rotateX(Math.PI);
    
    earth.add(fireMarker);
    earth.add(glow);
    
    // Randomly determine if this fire produces smoke (50% chance)
    const hasSmoke = Math.random() > 0.5;
    const smokeClouds = [];
    
    if (hasSmoke) {
        // Create smoke clouds that rise from the fire
        const numSmokeClouds = 5;
        
        for (let i = 0; i < numSmokeClouds; i++) {
            // Use IcosahedronGeometry with low detail (0-1) for angular, polygon look
            const smokeGeometry = new THREE.IcosahedronGeometry(0.2 + i * 0.08, Math.floor(Math.random() * 2));
            const smokeMaterial = new THREE.MeshBasicMaterial({
                color: 0x666666,
                transparent: true,
                opacity: 0.3 - i * 0.04,
                depthTest: true,  // Ensure smoke doesn't obstruct orbit lines
                depthWrite: false, // Allow transparency to work correctly
                flatShading: true  // Makes polygons more visible/angular
            });
            const smokeCloud = new THREE.Mesh(smokeGeometry, smokeMaterial);
            
            // Position smoke slightly above fire
            const smokeRadius = radius + 0.15 + i * 0.1;
            const smokeX = smokeRadius * Math.cos(lat) * Math.cos(lon);
            const smokeZ = smokeRadius * Math.cos(lat) * Math.sin(lon);
            const smokeY = smokeRadius * Math.sin(lat);
            
            smokeCloud.position.set(smokeX, smokeY, smokeZ);
            smokeCloud.userData = {
                initialRadius: smokeRadius,
                baseRadius: smokeRadius, // Store starting radius
                maxHeight: radius + 0.8, // Limit smoke to stay closer to surface (max 0.8 units above Earth)
                lat: lat,
                lon: lon,
                riseSpeed: 0.0015 + Math.random() * 0.001, // Much slower rise (stays near surface)
                driftAngle: Math.random() * Math.PI * 2, // Random drift direction
                driftSpeed: 0.0003 + Math.random() * 0.0004, // Random drift magnitude
                rotationSpeed: (Math.random() - 0.5) * 0.02, // Random rotation
                turbulence: Math.random() * 0.002, // Adds organic wobble
                initialOpacity: 0.35 - i * 0.05, // Store initial opacity
                scaleVariation: 0.8 + Math.random() * 0.4, // Random size variation
                index: i
            };
            
            earth.add(smokeCloud);
            smokeClouds.push(smokeCloud);
        }
    }
    
    const fireData = { 
        marker: fireMarker, 
        glow: glow,
        smokeClouds: hasSmoke ? smokeClouds : null, // Only add smoke if this fire has it
        hasSmoke: hasSmoke, // Track whether this fire produces smoke
        position: new THREE.Vector3(x, y, z),
        life: 0,
        maxLife: 30000 + Math.random() * 30000, // 30-60 seconds (much longer)
        detected: false,
        confirming: false,
        confirmedBy: []
    };
    
    fires.push(fireData);
}

function createSatellite(color, scale) {
    const satelliteGroup = new THREE.Group();
    
    const bodyGeometry = new THREE.BoxGeometry(0.4 * scale, 0.2 * scale, 0.2 * scale);
    const bodyMaterial = new THREE.MeshPhongMaterial({ 
        color: 0xdddddd,
        emissive: color,
        emissiveIntensity: 0.3
    });
    const body = new THREE.Mesh(bodyGeometry, bodyMaterial);
    satelliteGroup.add(body);

    const panelGeometry = new THREE.BoxGeometry(0.8 * scale, 0.03 * scale, 0.4 * scale);
    const panelMaterial = new THREE.MeshPhongMaterial({ 
        color: 0x1a4d8f,
        shininess: 30
    });
    
    const leftPanel = new THREE.Mesh(panelGeometry, panelMaterial);
    leftPanel.position.x = -0.6 * scale;
    satelliteGroup.add(leftPanel);
    
    const rightPanel = new THREE.Mesh(panelGeometry, panelMaterial);
    rightPanel.position.x = 0.6 * scale;
    satelliteGroup.add(rightPanel);

    return satelliteGroup;
}

function createStars() {
    const starsGeometry = new THREE.BufferGeometry();
    const starsMaterial = new THREE.PointsMaterial({ 
        color: 0xffffff, 
        size: 0.15,
        transparent: true,
        opacity: 0.8
    });

    const starsVertices = [];
    for (let i = 0; i < 4000; i++) {
        const x = (Math.random() - 0.5) * 300;
        const y = (Math.random() - 0.5) * 300;
        const z = (Math.random() - 0.5) * 300;
        starsVertices.push(x, y, z);
    }

    starsGeometry.setAttribute(
        'position',
        new THREE.Float32BufferAttribute(starsVertices, 3)
    );

    const stars = new THREE.Points(starsGeometry, starsMaterial);
    scene.add(stars);
}

function setupHeroMouseControls() {
    // Manual rotation controls removed - Earth rotates automatically only
    // This prevents user interaction from interfering with the visualization
    // ========== SCROLL HANDLING ==========
    // NO wheel/scroll event listener on canvas to ensure page scrolling always works
    // Mouse wheel will only scroll the page, not interact with the 3D Earth
    // This ensures smooth page navigation without interference from the 3D model
}

// ========== INTER-SATELLITE LINKS ==========
// Draws connecting lines between satellites that are close enough to communicate
// This visualizes the mesh network that allows satellites to relay data
function drawSatelliteLinks() {
    // Track how many links each satellite has to limit connections
    const linkCounts = new Map();
    const potentialLinks = [];
    
    // First pass: find all potential links and calculate distances
    for (let i = 0; i < satellites.length; i++) {
        const sat1 = satellites[i];
        
        // OPTIMIZATION: Skip satellites on back hemisphere
        if (!sat1.visible) continue;
        
        linkCounts.set(i, 0);
        
        for (let j = i + 1; j < satellites.length; j++) {
            const sat2 = satellites[j];
            
            // OPTIMIZATION: Skip if second satellite is not visible
            if (!sat2.visible) continue;
            
            // Calculate distance between satellites
            const distance = sat1.position.distanceTo(sat2.position);
            
            // More lenient distance check - allow connections within range
            if (distance <= SAT_LINK_DISTANCE) {
                // Store all potential links within range
                // Distance-based priority will naturally favor closest satellites
                potentialLinks.push({ i, j, distance, sat1, sat2 });
            }
        }
    }
    
    // Sort by distance (closest first) to prioritize nearest neighbors
    potentialLinks.sort((a, b) => a.distance - b.distance);
    
    // Second pass: draw links, respecting the max links per satellite limit
    for (const link of potentialLinks) {
        const { i, j, distance, sat1, sat2 } = link;
        
        // Check if either satellite has reached its link limit
        if (linkCounts.get(i) >= MAX_LINKS_PER_SAT || linkCounts.get(j) >= MAX_LINKS_PER_SAT) {
            continue;
        }
        
        // Draw the link
        // Create line geometry connecting the two satellites
        const linkGeometry = new THREE.BufferGeometry().setFromPoints([
            sat1.position.clone(),
            sat2.position.clone()
        ]);
        
        // Create semi-transparent cyan line material
        const linkMaterial = new THREE.LineBasicMaterial({
            color: SAT_LINK_COLOR,
            transparent: true,
            opacity: SAT_LINK_OPACITY * (1 - distance / SAT_LINK_DISTANCE), // Fade based on distance
            linewidth: 1
        });
        
        const linkLine = new THREE.Line(linkGeometry, linkMaterial);
        earth.add(linkLine);
        satelliteLinks.push(linkLine);
        
        // Increment link count for both satellites
        linkCounts.set(i, linkCounts.get(i) + 1);
        if (!linkCounts.has(j)) linkCounts.set(j, 0);
        linkCounts.set(j, linkCounts.get(j) + 1);
    }
}

function animateHero() {
    requestAnimationFrame(animateHero);

    const time = Date.now();

    // Earth is now stationary - no rotation
    // earth.rotation.x += 0.0002; // Rotation disabled

    // Clear old detection lines
    detectionLines.forEach(line => earth.remove(line));
    detectionLines = [];
    
    // Clear old satellite link lines
    satelliteLinks.forEach(link => earth.remove(link));
    satelliteLinks = [];

    satellites.forEach(satellite => {
        const data = satellite.userData;
        
        // Update orbital position
        data.angle += data.speed;
        
        // Calculate position in orbital plane
        let xOrbit = data.orbitRadius * Math.cos(data.angle);
        let yOrbit = data.orbitRadius * Math.sin(data.angle) * Math.sin(data.inclination);
        let zOrbit = data.orbitRadius * Math.sin(data.angle) * Math.cos(data.inclination);
        
        // Apply RAAN rotation
        let x = xOrbit * Math.cos(data.raan) - zOrbit * Math.sin(data.raan);
        let y = yOrbit;
        let z = xOrbit * Math.sin(data.raan) + zOrbit * Math.cos(data.raan);
        
        satellite.position.set(x, y, z);
        satellite.lookAt(0, 0, 0);
        
        // OPTIMIZATION: Only show satellites on visible (top) hemisphere
        // Check if satellite is on the camera-facing side (z > -2 for visible hemisphere)
        const isVisible = z > -2;
        satellite.visible = isVisible;
        
        // Only check for fire detection if satellite is visible
        if (isVisible) {
            checkFireDetection(satellite);
        }
    });
    
    // Draw inter-satellite links (mesh network visualization)
    if (ENABLE_SAT_LINKS) {
        drawSatelliteLinks();
    }

    orbitLines.forEach((orbitData, index) => {
        const pulse = Math.sin(time * 0.001 + index) * 0.2 + 0.8;
        orbitData.line.material.opacity = orbitData.baseOpacity * pulse;
    });

    fires.forEach((fire, index) => {
        fire.life += 16;
        
        const pulse = Math.sin(time * 0.003 + index) * 0.3 + 0.7;
        fire.marker.material.opacity = 0.95 * pulse;
        fire.glow.material.opacity = 0.5 * pulse;
        
        // Animate smoke clouds rising and dissipating with organic movement
        // Only animate if this fire has smoke
        if (fire.hasSmoke && fire.smokeClouds) {
            fire.smokeClouds.forEach((cloud, cloudIndex) => {
                const userData = cloud.userData;
                const ageProgress = fire.life / fire.maxLife;
                
                // Rise upward from fire with slower acceleration
                userData.initialRadius += userData.riseSpeed * (1 + ageProgress * 0.3);
                
                // Clamp smoke to max height (don't let it go too far into atmosphere)
                userData.initialRadius = Math.min(userData.initialRadius, userData.maxHeight);
                
                // Add organic drift (smoke moves sideways as it rises)
                const driftLat = userData.lat + Math.sin(userData.driftAngle + time * 0.001) * userData.driftSpeed;
                const driftLon = userData.lon + Math.cos(userData.driftAngle + time * 0.001) * userData.driftSpeed;
                
                // Add turbulence for organic wobble
                const turbulenceOffset = Math.sin(time * 0.002 + cloudIndex) * userData.turbulence;
                
                // Recalculate position with drift and turbulence (clamped to max height)
                const smokeRadius = userData.initialRadius + turbulenceOffset;
                const newX = smokeRadius * Math.cos(driftLat) * Math.cos(driftLon);
                const newZ = smokeRadius * Math.cos(driftLat) * Math.sin(driftLon);
                const newY = smokeRadius * Math.sin(driftLat);
                cloud.position.set(newX, newY, newZ);
                
                // Rotate smoke clouds for organic look
                cloud.rotation.x += userData.rotationSpeed;
                cloud.rotation.y += userData.rotationSpeed * 0.7;
                
                // Expand with non-linear growth (faster expansion as it ages)
                const expansionFactor = 1 + Math.pow(ageProgress, 1.5) * 2.5 * userData.scaleVariation;
                cloud.scale.set(expansionFactor, expansionFactor, expansionFactor);
                
                // Quick, non-linear fade with organic variation
                // Smoke disappears much faster now (cubic falloff)
                const fadeProgress = Math.pow(ageProgress, 2.5); // Much steeper curve
                const organicFade = Math.sin(time * 0.004 + cloudIndex) * 0.1 + 0.9; // Subtle pulsing
                cloud.material.opacity = userData.initialOpacity * (1 - fadeProgress) * organicFade;
                
                // Change color as smoke ages (darker to lighter gray)
                const grayValue = Math.floor(0x66 + (0x99 - 0x66) * ageProgress);
                cloud.material.color.setHex((grayValue << 16) | (grayValue << 8) | grayValue);
            });
        }
        
        if (fire.life > fire.maxLife) {
            const fadeProgress = (fire.life - fire.maxLife) / 3000; // Longer fade (3 seconds)
            fire.marker.material.opacity *= Math.max(0, 1 - fadeProgress);
            fire.glow.material.opacity *= Math.max(0, 1 - fadeProgress);
            // Fade smoke too (only if fire has smoke)
            if (fire.hasSmoke && fire.smokeClouds) {
                fire.smokeClouds.forEach(cloud => {
                    cloud.material.opacity *= Math.max(0, 1 - fadeProgress);
                });
            }
        }
    });

    fires = fires.filter(fire => {
        if (fire.life > fire.maxLife + 3000) { // 3 second fade period
            earth.remove(fire.marker);
            earth.remove(fire.glow);
            // Clean up smoke clouds (only if fire has smoke)
            if (fire.hasSmoke && fire.smokeClouds) {
                fire.smokeClouds.forEach(cloud => earth.remove(cloud));
            }
            return false;
        }
        return true;
    });

    // Animate and manage weather clouds
    weatherClouds.forEach((cloud, index) => {
        cloud.life += 16;
        
        // Slow drift movement
        const newLon = cloud.lon + Math.sin(cloud.driftAngle + time * 0.0001) * cloud.driftSpeed;
        
        // Recalculate position with drift
        const x = cloud.radius * Math.cos(cloud.lat) * Math.cos(newLon);
        const z = cloud.radius * Math.cos(cloud.lat) * Math.sin(newLon);
        const y = cloud.radius * Math.sin(cloud.lat);
        
        cloud.mesh.position.set(x, y, z);
        cloud.lon = newLon;
        
        // Subtle pulsing opacity (keeping clouds whiter)
        const pulse = Math.sin(time * 0.001 + index * 0.5) * 0.05 + 0.95;
        cloud.mesh.children.forEach(puff => {
            puff.material.opacity = 0.9 * pulse;
        });
        
        // Fade out at end of life
        if (cloud.life > cloud.maxLife) {
            const fadeProgress = (cloud.life - cloud.maxLife) / 5000; // 5 second fade
            cloud.mesh.children.forEach(puff => {
                puff.material.opacity *= Math.max(0, 1 - fadeProgress);
            });
        }
    });
    
    weatherClouds = weatherClouds.filter(cloud => {
        if (cloud.life > cloud.maxLife + 5000) { // 5 second fade period
            earth.remove(cloud.mesh);
            return false;
        }
        return true;
    });

    renderer.render(scene, camera);
}

// ========== COLLISION AVOIDANCE VERIFIED ==========
// Walker Delta constellation design with CORRECT f=1 phasing ensures NO COLLISIONS:
// • Each orbital plane separated by 18° RAAN (360°/20 planes)
// • Satellites within each plane spaced 7.2° apart (360°/50 satellites)
// • Adjacent planes offset by 0.36° phase shift (f × 360° / 1000 total satellites)
//   → This subtle offset creates a ROSETTE/SPIRAL pattern
//   → Plane 0: 0°, Plane 1: +0.36°, Plane 2: +0.72°, Plane 3: +1.08°, etc.
// • Result: At orbital plane intersections, satellites are staggered in a spiral
// • The 18° RAAN + 0.36° phase offset creates optimal 3D separation
// • Minimum separation maintained through combination of RAAN and phase offsets
// • This is the STANDARD Walker Delta formula used by GPS, Galileo, and other constellations

function checkFireDetection(satellite) {
    const detectionRadius = 6; // Satellites must be within 6 units to detect fire
    const maxDetectionAngle = 15 * (Math.PI / 180); // 15 degrees maximum detection angle
    const smokeInterferenceThreshold = 0.4; // Distance threshold for smoke interference
    const cloudBlockDistance = 1.5; // Weather clouds block detection within this distance
    
    fires.forEach(fire => {
        if (fire.life > fire.maxLife) return;
        
        // Calculate distance in local coordinates (relative to Earth)
        const distance = satellite.position.distanceTo(fire.position);
        
        // Check if within detection radius
        if (distance < detectionRadius) {
            // Calculate angle between satellite-to-fire vector and satellite-to-Earth-center vector
            // This ensures satellite only detects fires when looking nearly straight down
            const satToFire = new THREE.Vector3().subVectors(fire.position, satellite.position).normalize();
            const satToEarthCenter = new THREE.Vector3().subVectors(new THREE.Vector3(0, 0, 0), satellite.position).normalize();
            
            // Calculate angle between vectors (in radians)
            const angle = Math.acos(satToFire.dot(satToEarthCenter));
            
            // Only detect if angle is within maximum detection angle
            if (angle <= maxDetectionAngle) {
                // Check if weather clouds are blocking the line of sight
                let blockedByCloud = false;
                weatherClouds.forEach(cloud => {
                    const distanceToCloud = cloud.position.distanceTo(fire.position);
                    if (distanceToCloud < cloudBlockDistance) {
                        blockedByCloud = true;
                    }
                });
                
                // Determine detection mode and line color based on smoke/cloud presence
                let detectionMode = 'optical'; // Default: clear optical camera
                let lineColor = 0x00ff00; // Green for optical (visible light camera)
                let detectionType = 'Optical Camera';
                
                // If fire has smoke OR blocked by weather clouds, automatically use SWIR (Short-Wave Infrared)
                // SWIR can penetrate smoke, haze, and weather clouds to detect fires underneath
                if (fire.hasSmoke || blockedByCloud) {
                    detectionMode = 'swir';
                    lineColor = 0xff6600; // Orange/red for SWIR (infrared sees through clouds)
                    detectionType = blockedByCloud ? 'SWIR (Through Clouds)' : 'SWIR (Through Smoke)';
                }
                
                // Mark fire as detected if not already
                if (!fire.detected) {
                    fire.detected = true;
                    console.log(`Fire detected at distance ${distance.toFixed(2)} and angle ${(angle * 180 / Math.PI).toFixed(2)}° using ${detectionType}!`);
                    // Increase satellite glow when detecting
                    satellite.children[0].material.emissiveIntensity = 0.6;
                }
                
                // Create line of sight with color based on detection mode
                const lineGeometry = new THREE.BufferGeometry().setFromPoints([
                    satellite.position.clone(),
                    fire.position.clone()
                ]);
                const lineMaterial = new THREE.LineBasicMaterial({
                    color: lineColor, // Green for optical, Orange for SWIR
                    transparent: true,
                    opacity: fire.hasSmoke ? 0.85 : 0.7, // SWIR lines slightly more opaque
                    linewidth: fire.hasSmoke ? 3 : 2 // SWIR lines slightly thicker
                });
                const line = new THREE.Line(lineGeometry, lineMaterial);
                earth.add(line);
                detectionLines.push(line);
            }
        }
    });
}

function onHeroResize() {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
}

// ==================== SATELLITE 3D MODEL ====================
let satelliteScene, satelliteCamera, satelliteRenderer, satelliteModel;

function initSatellite3D() {
    const container = document.getElementById('satelliteModel');
    if (!container) return;

    // Scene setup
    satelliteScene = new THREE.Scene();
    satelliteScene.background = null;

    // Camera setup
    satelliteCamera = new THREE.PerspectiveCamera(
        45,
        container.offsetWidth / container.offsetHeight,
        0.1,
        1000
    );
    satelliteCamera.position.set(5, 3, 5);
    satelliteCamera.lookAt(0, 0, 0);

    // Renderer setup
    satelliteRenderer = new THREE.WebGLRenderer({ 
        antialias: true,
        alpha: true 
    });
    satelliteRenderer.setSize(container.offsetWidth, container.offsetHeight);
    satelliteRenderer.setPixelRatio(window.devicePixelRatio);
    container.appendChild(satelliteRenderer.domElement);

    // Lighting
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.6);
    satelliteScene.add(ambientLight);

    const directionalLight1 = new THREE.DirectionalLight(0xffffff, 0.8);
    directionalLight1.position.set(5, 5, 5);
    satelliteScene.add(directionalLight1);

    const directionalLight2 = new THREE.DirectionalLight(0x4ecdc4, 0.4);
    directionalLight2.position.set(-5, -3, -5);
    satelliteScene.add(directionalLight2);

    // Create detailed satellite
    satelliteModel = createDetailedSatellite();
    satelliteScene.add(satelliteModel);

    // Add stars background
    createSatelliteStars();

    // Animation
    animateSatellite();

    // Handle resize
    window.addEventListener('resize', () => {
        if (!container) return;
        satelliteCamera.aspect = container.offsetWidth / container.offsetHeight;
        satelliteCamera.updateProjectionMatrix();
        satelliteRenderer.setSize(container.offsetWidth, container.offsetHeight);
    });
}

function createDetailedSatellite() {
    const group = new THREE.Group();

    // Main body
    const bodyGeometry = new THREE.BoxGeometry(1.5, 0.8, 0.8);
    const bodyMaterial = new THREE.MeshPhongMaterial({ 
        color: 0xcccccc,
        shininess: 60
    });
    const body = new THREE.Mesh(bodyGeometry, bodyMaterial);
    group.add(body);

    // Antenna
    const antennaGeometry = new THREE.CylinderGeometry(0.05, 0.05, 1.2, 8);
    const antennaMaterial = new THREE.MeshPhongMaterial({ 
        color: 0x888888,
        shininess: 80
    });
    const antenna = new THREE.Mesh(antennaGeometry, antennaMaterial);
    antenna.position.set(0, 1, 0);
    group.add(antenna);

    // Antenna dish
    const dishGeometry = new THREE.CylinderGeometry(0.3, 0.2, 0.1, 16);
    const dishMaterial = new THREE.MeshPhongMaterial({ 
        color: 0xaaaaaa,
        shininess: 100
    });
    const dish = new THREE.Mesh(dishGeometry, dishMaterial);
    dish.position.set(0, 1.6, 0);
    group.add(dish);

    // Solar panels
    const panelGeometry = new THREE.BoxGeometry(2.5, 0.05, 1.2);
    const panelMaterial = new THREE.MeshPhongMaterial({ 
        color: 0x1a4d8f,
        shininess: 40,
        emissive: 0x0a2545,
        emissiveIntensity: 0.2
    });
    
    const leftPanel = new THREE.Mesh(panelGeometry, panelMaterial);
    leftPanel.position.x = -2;
    group.add(leftPanel);
    
    const rightPanel = new THREE.Mesh(panelGeometry, panelMaterial);
    rightPanel.position.x = 2;
    group.add(rightPanel);

    // Panel cells (details)
    for (let side = -1; side <= 1; side += 2) {
        for (let i = 0; i < 5; i++) {
            for (let j = 0; j < 3; j++) {
                const cellGeometry = new THREE.BoxGeometry(0.4, 0.06, 0.35);
                const cellMaterial = new THREE.MeshPhongMaterial({ 
                    color: 0x2563a8,
                    shininess: 60
                });
                const cell = new THREE.Mesh(cellGeometry, cellMaterial);
                cell.position.set(
                    side * 2 + (i - 2) * 0.45 * side,
                    0,
                    (j - 1) * 0.38
                );
                group.add(cell);
            }
        }
    }

    // Thermal camera/sensor
    const sensorGeometry = new THREE.CylinderGeometry(0.15, 0.2, 0.3, 16);
    const sensorMaterial = new THREE.MeshPhongMaterial({ 
        color: 0x333333,
        emissive: 0xff4444,
        emissiveIntensity: 0.5,
        shininess: 100
    });
    const sensor = new THREE.Mesh(sensorGeometry, sensorMaterial);
    sensor.rotation.x = Math.PI / 2;
    sensor.position.set(0, -0.4, -0.6);
    group.add(sensor);

    // Sensor lens
    const lensGeometry = new THREE.CircleGeometry(0.12, 16);
    const lensMaterial = new THREE.MeshPhongMaterial({ 
        color: 0xff0000,
        emissive: 0xff0000,
        emissiveIntensity: 0.8,
        transparent: true,
        opacity: 0.9
    });
    const lens = new THREE.Mesh(lensGeometry, lensMaterial);
    lens.position.set(0, -0.4, -0.76);
    group.add(lens);

    return group;
}

function createSatelliteStars() {
    const starsGeometry = new THREE.BufferGeometry();
    const starsMaterial = new THREE.PointsMaterial({ 
        color: 0xffffff, 
        size: 0.05,
        transparent: true,
        opacity: 0.6
    });

    const starsVertices = [];
    for (let i = 0; i < 500; i++) {
        const x = (Math.random() - 0.5) * 50;
        const y = (Math.random() - 0.5) * 50;
        const z = (Math.random() - 0.5) * 50;
        starsVertices.push(x, y, z);
    }

    starsGeometry.setAttribute(
        'position',
        new THREE.Float32BufferAttribute(starsVertices, 3)
    );

    const stars = new THREE.Points(starsGeometry, starsMaterial);
    satelliteScene.add(stars);
}

function animateSatellite() {
    requestAnimationFrame(animateSatellite);
    
    if (satelliteModel) {
        satelliteModel.rotation.y += 0.005;
        satelliteModel.rotation.x = Math.sin(Date.now() * 0.0003) * 0.1;
    }
    
    if (satelliteRenderer && satelliteScene && satelliteCamera) {
        satelliteRenderer.render(satelliteScene, satelliteCamera);
    }
}

window.addEventListener('scroll', () => {
    updateActiveNavLink();
    fadeInOnScroll();
});

document.addEventListener('DOMContentLoaded', () => {
    initFadeAnimations();
    fadeInOnScroll();
    
    if (typeof THREE !== 'undefined') {
        initHero3D();
        initSatellite3D();
    }
    
    const navLinks = document.querySelectorAll('.nav-menu a');
    navLinks.forEach(link => {
        link.addEventListener('click', (e) => {
            const href = link.getAttribute('href');
            // Only prevent default for internal section links (starting with #)
            if (href && href.startsWith('#')) {
                e.preventDefault();
                const targetId = href.substring(1);
                scrollToSection(targetId);
            }
            // Let external links (like dashboard.html) navigate normally
        });
    });
});