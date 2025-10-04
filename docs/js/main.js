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
let isDragging = false;
let previousMousePosition = { x: 0, y: 0 };
let autoRotate = true;

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
    camera.position.set(0, 0, 18);
    camera.lookAt(0, -8, 0);

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

    const pointLight1 = new THREE.PointLight(0x667eea, 1.5, 100);
    pointLight1.position.set(-15, 10, 10);
    scene.add(pointLight1);

    const pointLight2 = new THREE.PointLight(0x764ba2, 1, 100);
    pointLight2.position.set(15, 10, -10);
    scene.add(pointLight2);

    const earthGeometry = new THREE.SphereGeometry(10, 64, 64);
    const earthMaterial = new THREE.MeshPhongMaterial({
        color: 0x4a90e2,
        emissive: 0x1a3a5f,
        shininess: 40,
    });
    earth = new THREE.Mesh(earthGeometry, earthMaterial);
    earth.position.y = -10;
    scene.add(earth);

    const atmosphereGeometry = new THREE.SphereGeometry(10.4, 64, 64);
    const atmosphereMaterial = new THREE.MeshBasicMaterial({
        color: 0x667eea,
        transparent: true,
        opacity: 0.25,
        side: THREE.BackSide
    });
    const atmosphere = new THREE.Mesh(atmosphereGeometry, atmosphereMaterial);
    atmosphere.position.y = -10;
    scene.add(atmosphere);

    const outerGlowGeometry = new THREE.SphereGeometry(11, 64, 64);
    const outerGlowMaterial = new THREE.MeshBasicMaterial({
        color: 0x667eea,
        transparent: true,
        opacity: 0.1,
        side: THREE.BackSide
    });
    const outerGlow = new THREE.Mesh(outerGlowGeometry, outerGlowMaterial);
    outerGlow.position.y = -10;
    scene.add(outerGlow);

    createEarthDetails();

    const orbitConfigs = [
        { radius: 12, color: 0xff6b6b, speed: 0.0008, inclination: 0, satellites: 2 },
        { radius: 14, color: 0x4ecdc4, speed: 0.0006, inclination: Math.PI / 6, satellites: 3 },
        { radius: 16, color: 0xffe66d, speed: 0.0005, inclination: -Math.PI / 8, satellites: 2 },
        { radius: 18, color: 0x95e1d3, speed: 0.0004, inclination: Math.PI / 4, satellites: 2 }
    ];

    orbitConfigs.forEach((config, orbitIndex) => {
        const orbitPoints = [];
        for (let i = 0; i <= 100; i++) {
            const angle = (i / 100) * Math.PI * 2;
            const x = config.radius * Math.cos(angle);
            const y = config.radius * Math.sin(angle) * Math.sin(config.inclination) - 10;
            const z = config.radius * Math.sin(angle) * Math.cos(config.inclination);
            orbitPoints.push(new THREE.Vector3(x, y, z));
        }

        const orbitGeometry = new THREE.BufferGeometry().setFromPoints(orbitPoints);
        const orbitMaterial = new THREE.LineBasicMaterial({
            color: config.color,
            transparent: true,
            opacity: 0.4
        });

        const orbitLine = new THREE.Line(orbitGeometry, orbitMaterial);
        scene.add(orbitLine);
        orbitLines.push({ line: orbitLine, baseOpacity: 0.4 });

        for (let i = 0; i < config.satellites; i++) {
            const satellite = createSatellite(config.color, 0.6);
            satellite.userData = {
                orbitRadius: config.radius,
                speed: config.speed,
                angle: (i * Math.PI * 2) / config.satellites + (orbitIndex * 0.5),
                inclination: config.inclination
            };
            scene.add(satellite);
            satellites.push(satellite);
        }
    });

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
    
    const lat = (Math.random() - 0.5) * Math.PI;
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
    
    fires.push({ 
        marker: fireMarker, 
        glow: glow,
        life: 0,
        maxLife: 10000 + Math.random() * 5000
    });
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
        earth.rotation.y += deltaX * 0.005;

        previousMousePosition = { x: e.clientX, y: e.clientY };
    });

    canvas.addEventListener('mouseup', () => {
        isDragging = false;
        setTimeout(() => { autoRotate = true; }, 2000);
    });

    canvas.addEventListener('mouseleave', () => {
        isDragging = false;
    });
}

function animateHero() {
    requestAnimationFrame(animateHero);

    const time = Date.now();

    if (autoRotate) {
        earth.rotation.y += 0.0005;
    }

    satellites.forEach(satellite => {
        const data = satellite.userData;
        data.angle += data.speed;
        
        const x = data.orbitRadius * Math.cos(data.angle);
        const y = data.orbitRadius * Math.sin(data.angle) * Math.sin(data.inclination) - 10;
        const z = data.orbitRadius * Math.sin(data.angle) * Math.cos(data.inclination);
        
        satellite.position.set(x, y, z);
        satellite.lookAt(0, -10, 0);
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

function onHeroResize() {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
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
    }
    
    const navLinks = document.querySelectorAll('.nav-menu a');
    navLinks.forEach(link => {
        link.addEventListener('click', (e) => {
            e.preventDefault();
            const targetId = link.getAttribute('href').substring(1);
            scrollToSection(targetId);
        });
    });
});