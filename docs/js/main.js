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
let isDragging = false;
let previousMousePosition = { x: 0, y: 0 };
let autoRotate = true;
let confirmatingSatellites = [];

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
    // Position camera further back and lower to see more vertically without fisheye
    camera.position.set(0, -35, 25);  // Moved camera further back (Z: 12 -> 25)
    camera.lookAt(0, -5, 0);  // Look slightly higher to show more satellites above

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
    // Main Earth sphere with blue ocean color
    const earthGeometry = new THREE.SphereGeometry(10, 64, 64);
    const earthMaterial = new THREE.MeshPhongMaterial({
        color: 0x4a90e2,        // Ocean blue color
        emissive: 0x000000,     // No self-illumination
        shininess: 60,          // Glossy surface for water reflection
    });
    earth = new THREE.Mesh(earthGeometry, earthMaterial);
    earth.position.y = -25;
    scene.add(earth);

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

    // ========== WALKER DELTA CONSTELLATION: 56°:500/20/1 ==========
    // Based on Walker Delta pattern notation i:t/p/f (similar to Galileo navigation system):
    // i = 56° inclination (tilt of orbital plane relative to Earth's equator)
    // t = 500 total satellites
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
    // • 500 Satellites Total - 25 satellites evenly distributed in each of the 20 orbital planes
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
    
    const totalSatellites = 500;
    const numPlanes = 20;
    const satellitesPerPlane = totalSatellites / numPlanes; // 25 satellites per plane
    const inclination = 56 * (Math.PI / 180); // 56° inclination (Walker Delta standard)
    const orbitRadius = 14; // ~500-550 km altitude
    const orbitSpeed = 0.0006;
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
            const satellite = createSatellite(colors[plane], 0.2);
            
            // Calculate initial angle with Walker constellation phasing
            const phaseOffset = (phasingFactor * 2 * Math.PI * plane) / totalSatellites;
            const initialAngle = (sat * 2 * Math.PI) / satellitesPerPlane + phaseOffset;
            
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
    createStars();
    setupHeroMouseControls();

    window.addEventListener('resize', onHeroResize);

    animateHero();

    setInterval(() => {
        spawnRandomFire();
    }, 3000);
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
    for (let i = 0; i < 8; i++) {
        spawnRandomFire();
    }
}

function spawnRandomFire() {
    if (fires.length > 15) {
        const oldFire = fires.shift();
        earth.remove(oldFire.marker);
        earth.remove(oldFire.glow);
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
    const lat = (Math.random() - 0.5) * 2 * maxLatitude; // Random latitude between -56° and +56°
    const lon = Math.random() * Math.PI * 2;
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
    
    const fireData = { 
        marker: fireMarker, 
        glow: glow,
        position: new THREE.Vector3(x, y, z),
        life: 0,
        maxLife: 10000 + Math.random() * 5000,
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
    const canvas = renderer.domElement;
    
    canvas.addEventListener('mousedown', (e) => {
        isDragging = true;
        autoRotate = false;
        previousMousePosition = { x: e.clientX, y: e.clientY };
    });

    canvas.addEventListener('mousemove', (e) => {
        if (!isDragging) return;

        const deltaX = e.clientX - previousMousePosition.x;
        const deltaY = e.clientY - previousMousePosition.y;
        
        // Rotate on Y axis (horizontal mouse movement)
        earth.rotation.y += deltaX * 0.005;
        
        // Rotate on X axis (vertical mouse movement)
        earth.rotation.x += deltaY * 0.005;

        previousMousePosition = { x: e.clientX, y: e.clientY };
    });

    canvas.addEventListener('mouseup', () => {
        isDragging = false;
        setTimeout(() => { autoRotate = true; }, 2000);
    });

    canvas.addEventListener('mouseleave', () => {
        isDragging = false;
    });
    
    // ========== SCROLL HANDLING ==========
    // NO wheel/scroll event listener on canvas to ensure page scrolling always works
    // Mouse wheel will only scroll the page, not rotate the 3D Earth
    // Users can still rotate Earth using mouse drag (X/Y axes)
    // This ensures smooth page navigation without interference from the 3D model
}

function animateHero() {
    requestAnimationFrame(animateHero);

    const time = Date.now();

    if (autoRotate) {
        earth.rotation.y += 0.0005;
    }

    // Clear old detection lines
    detectionLines.forEach(line => earth.remove(line));
    detectionLines = [];

    satellites.forEach(satellite => {
        const data = satellite.userData;
        
        // Calculate next position
        const nextAngle = data.angle + data.speed;
        
        // Position in orbital plane with next angle
        let xOrbit = data.orbitRadius * Math.cos(nextAngle);
        let yOrbit = data.orbitRadius * Math.sin(nextAngle) * Math.sin(data.inclination);
        let zOrbit = data.orbitRadius * Math.sin(nextAngle) * Math.cos(data.inclination);
        
        // Apply RAAN rotation to position the plane correctly
        let x = xOrbit * Math.cos(data.raan) - zOrbit * Math.sin(data.raan);
        let y = yOrbit;
        let z = xOrbit * Math.sin(data.raan) + zOrbit * Math.cos(data.raan);
        
        const nextPos = new THREE.Vector3(x, y, z);
        
        // Anti-collision system: Check if next position would cause collision
        if (checkSatelliteCollision(nextPos, satellite)) {
            // DON'T move - stay at current position this frame
            // Satellite will wait until path is clear
            // This prevents phasing through other satellites
        } else {
            // Safe to move - update angle and position
            data.angle = nextAngle;
            satellite.position.set(x, y, z);
        }
        
        satellite.lookAt(0, 0, 0);
        
        // Check for fire detection and draw line of sight
        checkFireDetection(satellite);
    });

    orbitLines.forEach((orbitData, index) => {
        const pulse = Math.sin(time * 0.001 + index) * 0.2 + 0.8;
        orbitData.line.material.opacity = orbitData.baseOpacity * pulse;
    });

    fires.forEach((fire, index) => {
        fire.life += 16;
        
        const pulse = Math.sin(time * 0.003 + index) * 0.3 + 0.7;
        fire.marker.material.opacity = 0.95 * pulse;
        fire.glow.material.opacity = 0.5 * pulse;
        
        if (fire.life > fire.maxLife) {
            const fadeProgress = (fire.life - fire.maxLife) / 1000;
            fire.marker.material.opacity *= Math.max(0, 1 - fadeProgress);
            fire.glow.material.opacity *= Math.max(0, 1 - fadeProgress);
        }
    });

    fires = fires.filter(fire => {
        if (fire.life > fire.maxLife + 1000) {
            earth.remove(fire.marker);
            earth.remove(fire.glow);
            return false;
        }
        return true;
    });

    renderer.render(scene, camera);
}

function checkSatelliteCollision(newPos, currentSatellite) {
    const minDistance = 0.25; // Minimum safe distance between satellites (small for tiny satellites)
    let closestSatellite = null;
    let closestDistance = Infinity;
    let collisionDetected = false;
    
    for (let satellite of satellites) {
        if (satellite === currentSatellite) continue;
        
        const distance = newPos.distanceTo(satellite.position);
        
        if (distance < closestDistance) {
            closestDistance = distance;
            closestSatellite = satellite;
        }
        
        if (distance < minDistance) {
            collisionDetected = true;
        }
    }
    
    return { detected: collisionDetected, closestSatellite: closestSatellite, distance: closestDistance };
}

function checkFireDetection(satellite) {
    const detectionRadius = 6; // Satellites must be within 6 units to detect fire
    const maxDetectionAngle = 15 * (Math.PI / 180); // 15 degrees maximum detection angle
    
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
            
            // Only detect if angle is within 7 degrees of pointing at Earth center
            if (angle <= maxDetectionAngle) {
                // Mark fire as detected if not already
                if (!fire.detected) {
                    fire.detected = true;
                    console.log(`Fire detected at distance ${distance.toFixed(2)} and angle ${(angle * 180 / Math.PI).toFixed(2)}°!`);
                    // Increase satellite glow when detecting
                    satellite.children[0].material.emissiveIntensity = 0.6;
                }
                
                // Create line of sight
                const lineGeometry = new THREE.BufferGeometry().setFromPoints([
                    satellite.position.clone(),
                    fire.position.clone()
                ]);
                const lineMaterial = new THREE.LineBasicMaterial({
                    color: satellite.userData.orbitColor,
                    transparent: true,
                    opacity: 0.7,
                    linewidth: 2
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