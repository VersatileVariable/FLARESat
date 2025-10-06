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
let satelliteLinks = [];
let isDragging = false;
let previousMousePosition = { x: 0, y: 0 };
let autoRotate = true;
let confirmatingSatellites = [];
let weatherClouds = [];
let earthTextureData = null;
let earthTextureLoaded = false;
let simulationStarted = false;
let animationFrameId = null;

// Configuration for inter-satellite links
const ENABLE_SAT_LINKS = false; // Disabled by default for performance
const SAT_LINK_DISTANCE = 3.5;
const SAT_LINK_COLOR = 0x4ecdc4;
const SAT_LINK_OPACITY = 0.3;
const MAX_LINKS_PER_SAT = 3;

// Memory optimization: Reuse geometries and materials
const sharedGeometries = {};
const sharedMaterials = {};

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
    camera.position.set(0, -20, 15);
    camera.lookAt(0, -20, 0);

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

    const directionalLight = new THREE.DirectionalLight(0xffffff, 0.7);
    directionalLight.position.set(10, 20, 10);
    scene.add(directionalLight);

    const earthGeometry = new THREE.SphereGeometry(10, 64, 64);
    
    const earthMaterial = new THREE.MeshPhongMaterial({
        color: 0x4a90e2,
        shininess: 15,
        specular: 0x111111,
    });
    
    earth = new THREE.Mesh(earthGeometry, earthMaterial);
    earth.position.y = -30;
    earth.rotation.x = -Math.PI / 12;
    earth.rotation.y = Math.PI / 17;
    earth.rotation.z = 0;
    scene.add(earth);
    
    const textureLoader = new THREE.TextureLoader();
    textureLoader.setCrossOrigin('anonymous');
    
    textureLoader.load(
        'https://raw.githubusercontent.com/turban/webgl-earth/master/images/2_no_clouds_4k.jpg',
        (texture) => {
            console.log('Earth texture loaded successfully!');
            console.log('Texture dimensions:', texture.image.width, 'x', texture.image.height);
            
            earthMaterial.map = texture;
            earthMaterial.color.setHex(0xffffff);
            earthMaterial.needsUpdate = true;
            
            console.log('Texture applied to Earth material');
            
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
        (xhr) => {
            if (xhr.lengthComputable) {
                const percentComplete = xhr.loaded / xhr.total * 100;
                console.log('Loading texture:', percentComplete.toFixed(2) + '% loaded');
            }
        },
        (error) => {
            console.error('Error loading Earth texture:', error);
            console.log('Keeping blue fallback color for Earth');
            earthTextureLoaded = false;
        }
    );

    createEarthDetails();
    createEquator();

    const totalSatellites = 1000;
    const numPlanes = 20;
    const satellitesPerPlane = totalSatellites / numPlanes;
    const inclination = 56 * (Math.PI / 180);
    const orbitRadius = 14;
    const orbitSpeed = 0.00015; // Slowed down from 0.0003 (50% speed)
    const phasingFactor = 1;
    
    const colors = [
        0xff6b6b, 0x4ecdc4, 0xffe66d, 0x95e1d3, 0xffa07a,
        0x98d8c8, 0xf7b731, 0xeb4d4b, 0x6ab04c, 0x00a8ff,
        0xe056fd, 0x686de0, 0x30336b, 0xf8b500, 0xff3838,
        0x7ed6df, 0xf368e0, 0xff9ff3, 0x48dbfb, 0x0abde3
    ];

    for (let plane = 0; plane < numPlanes; plane++) {
        const raan = (plane * 2 * Math.PI) / numPlanes;
        
        const orbitPoints = [];
        for (let i = 0; i <= 100; i++) {
            const angle = (i / 100) * Math.PI * 2;
            
            const xOrbit = orbitRadius * Math.cos(angle);
            const yOrbit = orbitRadius * Math.sin(angle) * Math.sin(inclination);
            const zOrbit = orbitRadius * Math.sin(angle) * Math.cos(inclination);
            
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

        for (let sat = 0; sat < satellitesPerPlane; sat++) {
            const satellite = createSatellite(colors[plane], 0.1);
            
            const baseAngle = (sat * 2 * Math.PI) / satellitesPerPlane;
            const phaseOffset = (phasingFactor * plane * 2 * Math.PI) / totalSatellites;
            const initialAngle = baseAngle + phaseOffset;
            
            satellite.userData = {
                orbitRadius: orbitRadius,
                speed: orbitSpeed,
                angle: initialAngle,
                inclination: inclination,
                raan: raan,
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

    setInterval(() => {
        if (simulationStarted) {
            spawnRandomFire();
        }
    }, 2000);
    
    setInterval(() => {
        if (simulationStarted) {
            spawnWeatherCloud();
        }
    }, 8000);
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
    const equatorRadius = 10.02;
    const equatorPoints = [];
    
    for (let i = 0; i <= 100; i++) {
        const angle = (i / 100) * Math.PI * 2;
        const x = equatorRadius * Math.cos(angle);
        const z = equatorRadius * Math.sin(angle);
        equatorPoints.push(new THREE.Vector3(x, 0, z));
    }
    
    const equatorGeometry = new THREE.BufferGeometry().setFromPoints(equatorPoints);
    const equatorMaterial = new THREE.LineBasicMaterial({
        color: 0xffff00,
        transparent: true,
        opacity: 0.9,
        linewidth: 3,
        depthTest: true,
        depthWrite: true
    });
    
    const equatorLine = new THREE.Line(equatorGeometry, equatorMaterial);
    earth.add(equatorLine);
    
    const labelPositions = [0, Math.PI];
    
    labelPositions.forEach((angle) => {
        const canvas = document.createElement('canvas');
        const context = canvas.getContext('2d');
        canvas.width = 512;
        canvas.height = 128;
        
        context.fillStyle = 'rgba(255, 255, 0, 0.95)';
        context.font = 'Bold 56px Arial';
        context.textAlign = 'center';
        context.textBaseline = 'middle';
        context.fillText('EQUATOR', 256, 64);
        
        const texture = new THREE.CanvasTexture(canvas);
        
        const textGeometry = new THREE.PlaneGeometry(3, 0.75);
        const textMaterial = new THREE.MeshBasicMaterial({ 
            map: texture,
            transparent: true,
            side: THREE.DoubleSide,
            depthTest: true,
            depthWrite: true
        });
        const textMesh = new THREE.Mesh(textGeometry, textMaterial);
        
        const labelRadius = 10.05;
        textMesh.position.set(
            labelRadius * Math.cos(angle),
            0.5,
            labelRadius * Math.sin(angle)
        );
        
        textMesh.rotation.y = angle + Math.PI / 2;
        
        earth.add(textMesh);
    });
}

function createFires() {
    setTimeout(() => {
        console.log('Starting initial fire spawn. Texture loaded:', earthTextureLoaded);
        if (!earthTextureLoaded) {
            console.error('WARNING: Texture still not loaded after 5 seconds!');
            return;
        }
        for (let i = 0; i < 15; i++) {
            spawnRandomFire();
        }
    }, 5000);
}

function createWeatherClouds() {
    for (let i = 0; i < 4; i++) {
        spawnWeatherCloud();
    }
}

function spawnWeatherCloud() {
    if (weatherClouds.length > 15) {
        const oldCloud = weatherClouds.shift();
        oldCloud.mesh.children.forEach(puff => {
            if (puff.geometry) puff.geometry.dispose();
            if (puff.material) puff.material.dispose();
        });
        earth.remove(oldCloud.mesh);
    }

    const maxLatitude = 70 * (Math.PI / 180);
    
    // Get camera direction to only spawn on visible side
    const cameraWorldPos = camera.position.clone();
    const earthWorldPos = earth.position.clone();
    const cameraToEarth = new THREE.Vector3().subVectors(earthWorldPos, cameraWorldPos).normalize();
    
    const earthInverseMatrix = new THREE.Matrix4().copy(earth.matrix).invert();
    const cameraLocalDir = cameraToEarth.clone().applyMatrix4(earthInverseMatrix).normalize();
    
    // Only spawn on visible hemisphere (front side)
    const cameraPhi = Math.atan2(cameraLocalDir.z, cameraLocalDir.x);
    const minLon = cameraPhi - Math.PI / 3; // Narrower range (120 degrees instead of 180)
    const maxLon = cameraPhi + Math.PI / 3;
    
    const lat = (Math.random() - 0.5) * 2 * maxLatitude;
    const lon = minLon + Math.random() * (maxLon - minLon);
    const radius = 10.5;
    
    const cloudGroup = new THREE.Group();
    const numPuffs = 5 + Math.floor(Math.random() * 5);
    
    const clusterCenterX = (Math.random() - 0.5) * 0.3;
    const clusterCenterY = (Math.random() - 0.5) * 0.1;
    const clusterCenterZ = (Math.random() - 0.5) * 0.3;
    
    for (let i = 0; i < numPuffs; i++) {
        const size = 0.15 + Math.random() * 0.35;
        const detail = 0;
        
        const puffGeometry = new THREE.DodecahedronGeometry(size, detail);
        
        const baseOpacity = 0.7 + Math.random() * 0.25;
        const puffMaterial = new THREE.MeshPhongMaterial({
            color: 0xffffff,
            transparent: true,
            opacity: baseOpacity,
            shininess: 15 + Math.random() * 10,
            emissive: 0xffffff,
            emissiveIntensity: 0.2 + Math.random() * 0.15,
            flatShading: false
        });
        const puff = new THREE.Mesh(puffGeometry, puffMaterial);
        
        const distanceFromCenter = Math.pow(Math.random(), 1.5);
        const angle = Math.random() * Math.PI * 2;
        const verticalSpread = (Math.random() - 0.5) * 0.4;
        
        puff.position.set(
            clusterCenterX + Math.cos(angle) * distanceFromCenter * 1.2,
            clusterCenterY + verticalSpread,
            clusterCenterZ + Math.sin(angle) * distanceFromCenter * 1.2
        );
        
        const scaleX = 0.8 + Math.random() * 0.6;
        const scaleY = 0.7 + Math.random() * 0.5;
        const scaleZ = 0.8 + Math.random() * 0.6;
        puff.scale.set(scaleX, scaleY, scaleZ);
        
        puff.rotation.set(
            Math.random() * Math.PI * 2,
            Math.random() * Math.PI * 2,
            Math.random() * Math.PI * 2
        );
        
        cloudGroup.add(puff);
    }
    
    const x = radius * Math.cos(lat) * Math.cos(lon);
    const z = radius * Math.cos(lat) * Math.sin(lon);
    const y = radius * Math.sin(lat);
    
    cloudGroup.position.set(x, y, z);
    cloudGroup.lookAt(0, 0, 0);
    
    earth.add(cloudGroup);
    
    const puffData = [];
    cloudGroup.children.forEach((puff, i) => {
        puffData.push({
            originalPos: puff.position.clone(),
            originalScale: puff.scale.clone(),
            windPhase: Math.random() * Math.PI * 2,
            windAmplitude: 0.05 + Math.random() * 0.1,
            windSpeed: 0.8 + Math.random() * 0.4
        });
    });
    
    const cloudData = {
        mesh: cloudGroup,
        position: new THREE.Vector3(x, y, z),
        lat: lat,
        lon: lon,
        radius: radius,
        driftSpeed: 0.00005 + Math.random() * 0.00005, // Slowed down from 0.0001-0.0002 (50% speed)
        driftAngle: Math.random() * Math.PI * 2,
        windTurbulence: 0.00004 + Math.random() * 0.00006, // Slowed down (50% speed)
        windGustPhase: Math.random() * Math.PI * 2,
        stretchDirection: Math.random() * Math.PI * 2,
        life: 0,
        maxLife: 60000 + Math.random() * 60000,
        puffData: puffData
    };
    
    weatherClouds.push(cloudData);
}

function isOnLand(lat, lon) {
    if (!earthTextureLoaded || !earthTextureData) {
        console.warn('Texture not loaded yet! earthTextureLoaded:', earthTextureLoaded, 'earthTextureData:', !!earthTextureData);
        return false;
    }
    
    const u = (lon / (Math.PI * 2) + 0.5) % 1.0;
    const v = 0.5 - (lat / Math.PI);
    
    const x = Math.floor(u * earthTextureData.width);
    const y = Math.floor(v * earthTextureData.height);
    
    const isWaterAtPixel = (px, py) => {
        if (px < 0 || px >= earthTextureData.width || py < 0 || py >= earthTextureData.height) {
            return true;
        }
        
        const idx = (py * earthTextureData.width + px) * 4;
        const pr = earthTextureData.data[idx];
        const pg = earthTextureData.data[idx + 1];
        const pb = earthTextureData.data[idx + 2];
        
        if (pr <= 5 && pg >= 90 && pg <= 102 && pb >= 145 && pb <= 160) {
            return true;
        }
        
        return false;
    };
    
    const index = (y * earthTextureData.width + x) * 4;
    const r = earthTextureData.data[index];
    const g = earthTextureData.data[index + 1];
    const b = earthTextureData.data[index + 2];
    
    if (b > r + 10 || b > g + 10) {
        return false;
    }
    
    if (b >= 70 && (b > r || b > g)) {
        return false;
    }
    
    if (b > r && b > g && b >= 60) {
        return false;
    }
    
    const brightness = (r + g + b) / 3;
    if (brightness < 50 || brightness > 220) {
        return false;
    }
    
    const isGreen = (g > r + 15 && g > b + 15 && g >= 70 && g <= 180);
    const isBeige = (r >= 90 && g >= 70 && b >= 30 && b < r - 15 && b < g && Math.abs(r - g) < 60);
    
    if (!isGreen && !isBeige) {
        return false;
    }
    
    const bufferSize = 5;
    for (let dy = -bufferSize; dy <= bufferSize; dy++) {
        for (let dx = -bufferSize; dx <= bufferSize; dx++) {
            if (isWaterAtPixel(x + dx, y + dy)) {
                return false;
            }
        }
    }
    
    return true;
}

function spawnRandomFire() {
    if (fires.length > 8) {
        const oldFire = fires.shift();
        if (oldFire.marker.geometry) oldFire.marker.geometry.dispose();
        if (oldFire.marker.material) oldFire.marker.material.dispose();
        if (oldFire.glow.geometry) oldFire.glow.geometry.dispose();
        if (oldFire.glow.material) oldFire.glow.material.dispose();
        
        earth.remove(oldFire.marker);
        earth.remove(oldFire.glow);
        if (oldFire.smokeClouds) {
            oldFire.smokeClouds.forEach(cloud => {
                if (cloud.geometry) cloud.geometry.dispose();
                if (cloud.material) cloud.material.dispose();
                earth.remove(cloud);
            });
        }
    }

    if (!sharedGeometries.fire) {
        sharedGeometries.fire = new THREE.CircleGeometry(0.15, 8);
        sharedGeometries.fireGlow = new THREE.CircleGeometry(0.28, 8);
    }
    
    const fireMaterial = new THREE.MeshBasicMaterial({ 
        color: 0xff4444,
        transparent: true,
        opacity: 0.95
    });
    const fireMarker = new THREE.Mesh(sharedGeometries.fire, fireMaterial);
    
    const glowMaterial = new THREE.MeshBasicMaterial({ 
        color: 0xff6b6b,
        transparent: true,
        opacity: 0.5
    });
    const glow = new THREE.Mesh(sharedGeometries.fireGlow, glowMaterial);
    
    const maxLatitude = 56 * (Math.PI / 180);
    
    // Get camera direction to only spawn on visible side
    const cameraWorldPos = camera.position.clone();
    const earthWorldPos = earth.position.clone();
    const cameraToEarth = new THREE.Vector3().subVectors(earthWorldPos, cameraWorldPos).normalize();
    
    const earthInverseMatrix = new THREE.Matrix4().copy(earth.matrix).invert();
    const cameraLocalDir = cameraToEarth.clone().applyMatrix4(earthInverseMatrix).normalize();
    
    // Only spawn fires on visible hemisphere (narrower range)
    const cameraPhi = Math.atan2(cameraLocalDir.z, cameraLocalDir.x);
    const minLon = cameraPhi - Math.PI / 3; // Narrower: 120 degrees total instead of 180
    const maxLon = cameraPhi + Math.PI / 3;
    const lonRange = maxLon - minLon;
    
    let lat, lon;
    let attempts = 0;
    let foundLand = false;
    
    while (attempts < 50 && !foundLand) {
        lat = (Math.random() - 0.5) * 2 * maxLatitude;
        
        const rand = Math.random();
        let lonFraction;
        
        if (rand < 0.92) {
            lonFraction = 0.25 + Math.random() * 0.5;
        } else if (rand < 0.98) {
            lonFraction = Math.random() * 0.25;
        } else {
            lonFraction = 0.75 + Math.random() * 0.25;
        }
        
        lon = minLon + lonFraction * lonRange;
        
        if (isOnLand(lat, lon)) {
            foundLand = true;
        }
        attempts++;
    }
    
    if (!foundLand) {
        return;
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
    
    const hasSmoke = Math.random() > 0.5;
    const smokeClouds = [];
    
    if (hasSmoke) {
        const numSmokeClouds = 5;
        
        for (let i = 0; i < numSmokeClouds; i++) {
            const smokeGeometry = new THREE.IcosahedronGeometry(0.2 + i * 0.08, Math.floor(Math.random() * 2));
            const smokeMaterial = new THREE.MeshBasicMaterial({
                color: 0x666666,
                transparent: true,
                opacity: 0.3 - i * 0.04,
                depthTest: true,
                depthWrite: false,
                flatShading: true
            });
            const smokeCloud = new THREE.Mesh(smokeGeometry, smokeMaterial);
            
            const smokeRadius = radius + 0.15 + i * 0.1;
            const smokeX = smokeRadius * Math.cos(lat) * Math.cos(lon);
            const smokeZ = smokeRadius * Math.cos(lat) * Math.sin(lon);
            const smokeY = smokeRadius * Math.sin(lat);
            
            smokeCloud.position.set(smokeX, smokeY, smokeZ);
            smokeCloud.userData = {
                initialRadius: smokeRadius,
                baseRadius: smokeRadius,
                maxHeight: radius + 0.8,
                lat: lat,
                lon: lon,
                riseSpeed: 0.0015 + Math.random() * 0.001,
                driftAngle: Math.random() * Math.PI * 2,
                driftSpeed: 0.0003 + Math.random() * 0.0004,
                rotationSpeed: (Math.random() - 0.5) * 0.02,
                turbulence: Math.random() * 0.002,
                initialOpacity: 0.35 - i * 0.05,
                scaleVariation: 0.8 + Math.random() * 0.4,
                index: i
            };
            
            earth.add(smokeCloud);
            smokeClouds.push(smokeCloud);
        }
    }
    
    const fireData = { 
        marker: fireMarker, 
        glow: glow,
        smokeClouds: hasSmoke ? smokeClouds : null,
        hasSmoke: hasSmoke,
        position: new THREE.Vector3(x, y, z),
        life: 0,
        maxLife: 30000 + Math.random() * 30000,
        detected: false,
        confirming: false,
        confirmedBy: []
    };
    
    fires.push(fireData);
}

function createSatellite(color, scale) {
    if (!sharedGeometries.satelliteBody) {
        sharedGeometries.satelliteBody = new THREE.BoxGeometry(0.4, 0.2, 0.2);
        sharedGeometries.satellitePanel = new THREE.BoxGeometry(0.8, 0.03, 0.4);
    }
    
    const satelliteGroup = new THREE.Group();
    
    const bodyMaterialKey = `body_${color}`;
    if (!sharedMaterials[bodyMaterialKey]) {
        sharedMaterials[bodyMaterialKey] = new THREE.MeshPhongMaterial({ 
            color: 0xdddddd,
            emissive: color,
            emissiveIntensity: 0.3
        });
    }
    
    const body = new THREE.Mesh(sharedGeometries.satelliteBody, sharedMaterials[bodyMaterialKey]);
    body.scale.set(scale, scale, scale);
    satelliteGroup.add(body);

    if (!sharedMaterials.panel) {
        sharedMaterials.panel = new THREE.MeshPhongMaterial({ 
            color: 0x1a4d8f,
            shininess: 30
        });
    }
    
    const leftPanel = new THREE.Mesh(sharedGeometries.satellitePanel, sharedMaterials.panel);
    leftPanel.position.x = -0.6 * scale;
    leftPanel.scale.set(scale, scale, scale);
    satelliteGroup.add(leftPanel);
    
    const rightPanel = new THREE.Mesh(sharedGeometries.satellitePanel, sharedMaterials.panel);
    rightPanel.position.x = 0.6 * scale;
    rightPanel.scale.set(scale, scale, scale);
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
}

function drawSatelliteLinks() {
    const linkCounts = new Map();
    const potentialLinks = [];
    
    for (let i = 0; i < satellites.length; i++) {
        const sat1 = satellites[i];
        
        if (!sat1.visible) continue;
        
        linkCounts.set(i, 0);
        
        for (let j = i + 1; j < satellites.length; j++) {
            const sat2 = satellites[j];
            
            if (!sat2.visible) continue;
            
            const distance = sat1.position.distanceTo(sat2.position);
            
            if (distance <= SAT_LINK_DISTANCE) {
                potentialLinks.push({ i, j, distance, sat1, sat2 });
            }
        }
    }
    
    potentialLinks.sort((a, b) => a.distance - b.distance);
    
    for (const link of potentialLinks) {
        const { i, j, distance, sat1, sat2 } = link;
        
        if (linkCounts.get(i) >= MAX_LINKS_PER_SAT || linkCounts.get(j) >= MAX_LINKS_PER_SAT) {
            continue;
        }
        
        const linkGeometry = new THREE.BufferGeometry().setFromPoints([
            sat1.position.clone(),
            sat2.position.clone()
        ]);
        
        const linkMaterial = new THREE.LineBasicMaterial({
            color: SAT_LINK_COLOR,
            transparent: true,
            opacity: SAT_LINK_OPACITY * (1 - distance / SAT_LINK_DISTANCE),
            linewidth: 1
        });
        
        const linkLine = new THREE.Line(linkGeometry, linkMaterial);
        earth.add(linkLine);
        satelliteLinks.push(linkLine);
        
        linkCounts.set(i, linkCounts.get(i) + 1);
        if (!linkCounts.has(j)) linkCounts.set(j, 0);
        linkCounts.set(j, linkCounts.get(j) + 1);
    }
}

function animateHero() {
    if (!simulationStarted) return;
    
    animationFrameId = requestAnimationFrame(animateHero);

    const time = Date.now();

    detectionLines.forEach(line => earth.remove(line));
    detectionLines = [];
    
    satelliteLinks.forEach(link => earth.remove(link));
    satelliteLinks = [];

    satellites.forEach(satellite => {
        const data = satellite.userData;
        
        data.angle += data.speed;
        
        let xOrbit = data.orbitRadius * Math.cos(data.angle);
        let yOrbit = data.orbitRadius * Math.sin(data.angle) * Math.sin(data.inclination);
        let zOrbit = data.orbitRadius * Math.sin(data.angle) * Math.cos(data.inclination);
        
        let x = xOrbit * Math.cos(data.raan) - zOrbit * Math.sin(data.raan);
        let y = yOrbit;
        let z = xOrbit * Math.sin(data.raan) + zOrbit * Math.cos(data.raan);
        
        if (z < -3) {
            data.angle = data.angle + Math.PI;
            
            data.angle = data.angle % (Math.PI * 2);
            if (data.angle < 0) data.angle += Math.PI * 2;
            
            xOrbit = data.orbitRadius * Math.cos(data.angle);
            yOrbit = data.orbitRadius * Math.sin(data.angle) * Math.sin(data.inclination);
            zOrbit = data.orbitRadius * Math.sin(data.angle) * Math.cos(data.inclination);
            
            x = xOrbit * Math.cos(data.raan) - zOrbit * Math.sin(data.raan);
            y = yOrbit;
            z = xOrbit * Math.sin(data.raan) + zOrbit * Math.cos(data.raan);
        }
        
        satellite.position.set(x, y, z);
        satellite.lookAt(0, 0, 0);
        
        const isVisible = z > -3;
        satellite.visible = isVisible;
        
        if (isVisible) {
            checkFireDetection(satellite);
        }
    });
    
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
        
        if (fire.hasSmoke && fire.smokeClouds) {
            fire.smokeClouds.forEach((cloud, cloudIndex) => {
                const userData = cloud.userData;
                const ageProgress = fire.life / fire.maxLife;
                
                userData.initialRadius += userData.riseSpeed * (1 + ageProgress * 0.3);
                
                userData.initialRadius = Math.min(userData.initialRadius, userData.maxHeight);
                
                const driftLat = userData.lat + Math.sin(userData.driftAngle + time * 0.001) * userData.driftSpeed;
                const driftLon = userData.lon + Math.cos(userData.driftAngle + time * 0.001) * userData.driftSpeed;
                
                const turbulenceOffset = Math.sin(time * 0.002 + cloudIndex) * userData.turbulence;
                
                const smokeRadius = userData.initialRadius + turbulenceOffset;
                const newX = smokeRadius * Math.cos(driftLat) * Math.cos(driftLon);
                const newZ = smokeRadius * Math.cos(driftLat) * Math.sin(driftLon);
                const newY = smokeRadius * Math.sin(driftLat);
                cloud.position.set(newX, newY, newZ);
                
                cloud.rotation.x += userData.rotationSpeed;
                cloud.rotation.y += userData.rotationSpeed * 0.7;
                
                const expansionFactor = 1 + Math.pow(ageProgress, 1.5) * 2.5 * userData.scaleVariation;
                cloud.scale.set(expansionFactor, expansionFactor, expansionFactor);
                
                const fadeProgress = Math.pow(ageProgress, 2.5);
                const organicFade = Math.sin(time * 0.004 + cloudIndex) * 0.1 + 0.9;
                cloud.material.opacity = userData.initialOpacity * (1 - fadeProgress) * organicFade;
                
                const grayValue = Math.floor(0x66 + (0x99 - 0x66) * ageProgress);
                cloud.material.color.setHex((grayValue << 16) | (grayValue << 8) | grayValue);
            });
        }
        
        if (fire.life > fire.maxLife) {
            const fadeProgress = (fire.life - fire.maxLife) / 3000;
            fire.marker.material.opacity *= Math.max(0, 1 - fadeProgress);
            fire.glow.material.opacity *= Math.max(0, 1 - fadeProgress);
            if (fire.hasSmoke && fire.smokeClouds) {
                fire.smokeClouds.forEach(cloud => {
                    cloud.material.opacity *= Math.max(0, 1 - fadeProgress);
                });
            }
        }
    });

    fires = fires.filter(fire => {
        if (fire.life > fire.maxLife + 3000) {
            if (fire.marker.geometry) fire.marker.geometry.dispose();
            if (fire.marker.material) fire.marker.material.dispose();
            if (fire.glow.geometry) fire.glow.geometry.dispose();
            if (fire.glow.material) fire.glow.material.dispose();
            
            earth.remove(fire.marker);
            earth.remove(fire.glow);
            if (fire.hasSmoke && fire.smokeClouds) {
                fire.smokeClouds.forEach(cloud => {
                    if (cloud.geometry) cloud.geometry.dispose();
                    if (cloud.material) cloud.material.dispose();
                    earth.remove(cloud);
                });
            }
            return false;
        }
        return true;
    });

    weatherClouds.forEach((cloud, index) => {
        cloud.life += 16;
        
        const windGust = Math.sin(time * 0.0005 + cloud.windGustPhase) * 0.5 + 0.5;
        const turbulence = Math.sin(time * 0.0008 + index) * cloud.windTurbulence;
        const effectiveDriftSpeed = cloud.driftSpeed * (1 + windGust * 0.5);
        
        const newLon = cloud.lon + effectiveDriftSpeed * 3.0;
        const newLat = cloud.lat + turbulence * 0.5;
        
        const x = cloud.radius * Math.cos(newLat) * Math.cos(newLon);
        const z = cloud.radius * Math.cos(newLat) * Math.sin(newLon);
        const y = cloud.radius * Math.sin(newLat);
        
        cloud.mesh.position.set(x, y, z);
        cloud.lon = newLon;
        cloud.lat = newLat;
        
        cloud.mesh.rotation.y += 0.0002 * (1 + windGust * 0.3);
        
        const stretchFactor = 1 + windGust * 0.15;
        const stretchX = Math.cos(cloud.stretchDirection) * stretchFactor;
        const stretchZ = Math.sin(cloud.stretchDirection) * stretchFactor;
        
        cloud.mesh.scale.set(stretchX, 1, stretchZ);
        
        const pulse = Math.sin(time * 0.001 + index * 0.5) * 0.05 + 0.95;
        const windOpacityVariation = windGust * 0.05;
        const cloudOpacity = (0.9 * pulse) - windOpacityVariation;
        
        cloud.mesh.children.forEach((puff) => {
            puff.material.opacity = cloudOpacity;
        });
        
        if (cloud.life > cloud.maxLife) {
            const fadeProgress = (cloud.life - cloud.maxLife) / 5000;
            cloud.mesh.children.forEach(puff => {
                puff.material.opacity *= Math.max(0, 1 - fadeProgress);
            });
        }
    });
    
    weatherClouds = weatherClouds.filter(cloud => {
        if (cloud.life > cloud.maxLife + 5000) {
            cloud.mesh.children.forEach(puff => {
                if (puff.geometry) puff.geometry.dispose();
                if (puff.material) puff.material.dispose();
            });
            earth.remove(cloud.mesh);
            return false;
        }
        return true;
    });

    renderer.render(scene, camera);
}

function checkFireDetection(satellite) {
    const detectionRadius = 6;
    const maxDetectionAngle = 15 * (Math.PI / 180);
    const smokeInterferenceThreshold = 0.4;
    const cloudBlockDistance = 1.5;
    
    fires.forEach(fire => {
        if (fire.life > fire.maxLife) return;
        
        const distance = satellite.position.distanceTo(fire.position);
        
        if (distance < detectionRadius) {
            const satToFire = new THREE.Vector3().subVectors(fire.position, satellite.position).normalize();
            const satToEarthCenter = new THREE.Vector3().subVectors(new THREE.Vector3(0, 0, 0), satellite.position).normalize();
            
            const angle = Math.acos(satToFire.dot(satToEarthCenter));
            
            if (angle <= maxDetectionAngle) {
                let blockedByCloud = false;
                weatherClouds.forEach(cloud => {
                    const distanceToCloud = cloud.position.distanceTo(fire.position);
                    if (distanceToCloud < cloudBlockDistance) {
                        blockedByCloud = true;
                    }
                });
                
                let detectionMode = 'optical';
                let lineColor = 0x00ff00;
                let detectionType = 'Optical Camera';
                
                if (fire.hasSmoke || blockedByCloud) {
                    detectionMode = 'swir';
                    lineColor = 0xff6600;
                    detectionType = blockedByCloud ? 'SWIR (Through Clouds)' : 'SWIR (Through Smoke)';
                }
                
                if (!fire.detected) {
                    fire.detected = true;
                    console.log(`Fire detected at distance ${distance.toFixed(2)} and angle ${(angle * 180 / Math.PI).toFixed(2)}° using ${detectionType}!`);
                    satellite.children[0].material.emissiveIntensity = 0.6;
                }
                
                const lineGeometry = new THREE.BufferGeometry().setFromPoints([
                    satellite.position.clone(),
                    fire.position.clone()
                ]);
                const lineMaterial = new THREE.LineBasicMaterial({
                    color: lineColor,
                    transparent: true,
                    opacity: fire.hasSmoke ? 0.85 : 0.7,
                    linewidth: fire.hasSmoke ? 3 : 2
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

let satelliteScene, satelliteCamera, satelliteRenderer, satelliteModel;

function initSatellite3D() {
    const container = document.getElementById('satelliteModel');
    if (!container) return;

    satelliteScene = new THREE.Scene();
    satelliteScene.background = null;

    satelliteCamera = new THREE.PerspectiveCamera(
        45,
        container.offsetWidth / container.offsetHeight,
        0.1,
        1000
    );
    satelliteCamera.position.set(5, 3, 5);
    satelliteCamera.lookAt(0, 0, 0);

    satelliteRenderer = new THREE.WebGLRenderer({ 
        antialias: true,
        alpha: true 
    });
    satelliteRenderer.setSize(container.offsetWidth, container.offsetHeight);
    satelliteRenderer.setPixelRatio(window.devicePixelRatio);
    container.appendChild(satelliteRenderer.domElement);

    const ambientLight = new THREE.AmbientLight(0xffffff, 0.6);
    satelliteScene.add(ambientLight);

    const directionalLight1 = new THREE.DirectionalLight(0xffffff, 0.8);
    directionalLight1.position.set(5, 5, 5);
    satelliteScene.add(directionalLight1);

    const directionalLight2 = new THREE.DirectionalLight(0x4ecdc4, 0.4);
    directionalLight2.position.set(-5, -3, -5);
    satelliteScene.add(directionalLight2);

    const loader = new THREE.GLTFLoader();
    loader.load(
        'assets/FinalSatPres.glb',
        function(gltf) {
            satelliteModel = gltf.scene;
            satelliteModel.scale.set(1, 1, 1);
            satelliteModel.position.set(0, 0, 0);
            satelliteScene.add(satelliteModel);
            console.log('Satellite model loaded successfully');
        },
        function(xhr) {
            console.log((xhr.loaded / xhr.total * 100) + '% loaded');
        },
        function(error) {
            console.error('Error loading satellite model:', error);
            satelliteModel = createDetailedSatellite();
            satelliteScene.add(satelliteModel);
        }
    );

    createSatelliteStars();
    animateSatellite();

    window.addEventListener('resize', () => {
        if (!container) return;
        satelliteCamera.aspect = container.offsetWidth / container.offsetHeight;
        satelliteCamera.updateProjectionMatrix();
        satelliteRenderer.setSize(container.offsetWidth, container.offsetHeight);
    });
}

function createDetailedSatellite() {
    const group = new THREE.Group();

    const bodyGeometry = new THREE.BoxGeometry(1.5, 0.8, 0.8);
    const bodyMaterial = new THREE.MeshPhongMaterial({ 
        color: 0xcccccc,
        shininess: 60
    });
    const body = new THREE.Mesh(bodyGeometry, bodyMaterial);
    group.add(body);

    const antennaGeometry = new THREE.CylinderGeometry(0.05, 0.05, 1.2, 8);
    const antennaMaterial = new THREE.MeshPhongMaterial({ 
        color: 0x888888,
        shininess: 80
    });
    const antenna = new THREE.Mesh(antennaGeometry, antennaMaterial);
    antenna.position.set(0, 1, 0);
    group.add(antenna);

    const dishGeometry = new THREE.CylinderGeometry(0.3, 0.2, 0.1, 16);
    const dishMaterial = new THREE.MeshPhongMaterial({ 
        color: 0xaaaaaa,
        shininess: 100
    });
    const dish = new THREE.Mesh(dishGeometry, dishMaterial);
    dish.position.set(0, 1.6, 0);
    group.add(dish);

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
    
    if (!simulationStarted && typeof scene !== 'undefined') {
        const heroSection = document.querySelector('.hero');
        if (heroSection) {
            const rect = heroSection.getBoundingClientRect();
            const visibleHeight = Math.min(rect.bottom, window.innerHeight) - Math.max(rect.top, 0);
            const visiblePercent = visibleHeight / rect.height;
            
            if (visiblePercent > 0.3) {
                simulationStarted = true;
                console.log('3D Earth simulation started!');
                animateHero();
            }
        }
    }
});

document.addEventListener('DOMContentLoaded', () => {
    initFadeAnimations();
    fadeInOnScroll();
    
    if (typeof THREE !== 'undefined') {
        initHero3D();
        initSatellite3D();
    }
    
    setTimeout(() => {
        const heroSection = document.querySelector('.hero');
        if (heroSection && !simulationStarted) {
            const rect = heroSection.getBoundingClientRect();
            const visibleHeight = Math.min(rect.bottom, window.innerHeight) - Math.max(rect.top, 0);
            const visiblePercent = visibleHeight / rect.height;
            
            if (visiblePercent > 0.3) {
                simulationStarted = true;
                console.log('3D Earth simulation started on load!');
                animateHero();
            }
        }
    }, 100);
    
    const navLinks = document.querySelectorAll('.nav-menu a');
    navLinks.forEach(link => {
        link.addEventListener('click', (e) => {
            const href = link.getAttribute('href');
            if (href && href.startsWith('#')) {
                e.preventDefault();
                const targetId = href.substring(1);
                scrollToSection(targetId);
            }
        });
    });
});gi