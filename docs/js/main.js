// ==================== LEO BUSINESS CHALLENGE - MAIN JAVASCRIPT ====================

console.log('LEO Business Challenge - Initialized');

// ==================== SMOOTH SCROLLING ====================
function scrollToSection(sectionId) {
    const element = document.getElementById(sectionId);
    if (element) {
        element.scrollIntoView({ 
            behavior: 'smooth',
            block: 'start'
        });
    }
}

// ==================== NAVIGATION ACTIVE STATE ====================
function updateActiveNavLink() {
    const sections = document.querySelectorAll('.section, .hero');
    const navLinks = document.querySelectorAll('.nav-menu a');
    
    let currentSection = '';
    
    sections.forEach(section => {
        const sectionTop = section.offsetTop;
        const sectionHeight = section.clientHeight;
        
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

// ==================== SCROLL ANIMATIONS ====================
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

// ==================== THREE.JS 3D MODEL ====================
let scene, camera, renderer, earthHemisphere, satellites = [], orbitLines = [];
let isDragging = false;
let previousMousePosition = { x: 0, y: 0 };

function init3DModel() {
    const container = document.getElementById('canvas-container');
    if (!container) return;

    // Scene setup
    scene = new THREE.Scene();
    scene.background = new THREE.Color(0x0a0a1e);

    // Camera setup - positioned for 2D side view
    camera = new THREE.PerspectiveCamera(
        50,
        container.clientWidth / container.clientHeight,
        0.1,
        1000
    );
    camera.position.set(0, 0, 20);
    camera.lookAt(0, 0, 0);

    // Renderer setup
    renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setSize(container.clientWidth, container.clientHeight);
    renderer.setPixelRatio(window.devicePixelRatio);
    container.appendChild(renderer.domElement);

    // Lights
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.6);
    scene.add(ambientLight);

    const directionalLight = new THREE.DirectionalLight(0xffffff, 0.8);
    directionalLight.position.set(5, 5, 10);
    scene.add(directionalLight);

    const pointLight = new THREE.PointLight(0x667eea, 0.8, 100);
    pointLight.position.set(-10, 5, 10);
    scene.add(pointLight);

    // Create Earth Hemisphere (bottom half visible)
    const earthGeometry = new THREE.SphereGeometry(4, 64, 64, 0, Math.PI * 2, 0, Math.PI / 2);
    const earthMaterial = new THREE.MeshPhongMaterial({
        color: 0x2b5aa3,
        emissive: 0x0a1f3f,
        shininess: 30,
        flatShading: false
    });
    earthHemisphere = new THREE.Mesh(earthGeometry, earthMaterial);
    earthHemisphere.rotation.x = -Math.PI / 2;
    scene.add(earthHemisphere);

    // Add atmosphere glow to hemisphere
    const atmosphereGeometry = new THREE.SphereGeometry(4.15, 64, 64, 0, Math.PI * 2, 0, Math.PI / 2);
    const atmosphereMaterial = new THREE.MeshBasicMaterial({
        color: 0x667eea,
        transparent: true,
        opacity: 0.25,
        side: THREE.BackSide
    });
    const atmosphere = new THREE.Mesh(atmosphereGeometry, atmosphereMaterial);
    atmosphere.rotation.x = -Math.PI / 2;
    scene.add(atmosphere);

    // Add grid lines on Earth surface for detail
    createEarthGrid();

    // Create multiple orbit routes at different altitudes
    const orbits = [
        { radius: 5.5, color: 0xff6b6b, speed: 0.0008, tilt: 0 },
        { radius: 6.5, color: 0x4ecdc4, speed: 0.0006, tilt: Math.PI / 6 },
        { radius: 7.5, color: 0xffe66d, speed: 0.0005, tilt: -Math.PI / 8 },
        { radius: 8.5, color: 0x95e1d3, speed: 0.0004, tilt: Math.PI / 4 }
    ];

    orbits.forEach((orbit, index) => {
        // Create orbit line (ellipse for 2D appearance)
        const orbitCurve = new THREE.EllipseCurve(
            0, 0,
            orbit.radius, orbit.radius,
            0, 2 * Math.PI,
            false,
            0
        );
        
        const orbitPoints = orbitCurve.getPoints(100);
        const orbitGeometry = new THREE.BufferGeometry().setFromPoints(orbitPoints);
        const orbitMaterial = new THREE.LineBasicMaterial({ 
            color: orbit.color,
            transparent: true,
            opacity: 0.4,
            linewidth: 2
        });
        
        const orbitLine = new THREE.Line(orbitGeometry, orbitMaterial);
        orbitLine.rotation.x = orbit.tilt;
        scene.add(orbitLine);
        orbitLines.push(orbitLine);

        // Create satellite on this orbit
        const satellite = createSatellite(orbit.color);
        satellite.userData = {
            orbitRadius: orbit.radius,
            speed: orbit.speed,
            angle: (index * Math.PI * 2) / orbits.length,
            tilt: orbit.tilt
        };
        scene.add(satellite);
        satellites.push(satellite);
    });

    // Add dashed arc lines above Earth to show satellite paths
    createPathArcs();

    // Stars background
    createStars();

    // Add clouds floating above Earth
    createClouds();

    // Mouse controls
    setupMouseControls(container);

    // Reset button
    document.getElementById('reset-view').addEventListener('click', resetCamera);

    // Handle window resize
    window.addEventListener('resize', onWindowResize);

    // Start animation
    animate();
}

function createEarthGrid() {
    // Create latitude lines
    for (let lat = 0; lat < Math.PI / 2; lat += Math.PI / 12) {
        const radius = 4 * Math.cos(lat);
        const yPos = 4 * Math.sin(lat);
        
        const curve = new THREE.EllipseCurve(0, 0, radius, radius, 0, 2 * Math.PI, false, 0);
        const points = curve.getPoints(50);
        const geometry = new THREE.BufferGeometry().setFromPoints(points);
        const material = new THREE.LineBasicMaterial({ 
            color: 0x1a4d8f, 
            transparent: true, 
            opacity: 0.3 
        });
        const line = new THREE.Line(geometry, material);
        line.position.y = yPos;
        earthHemisphere.add(line);
    }

    // Create longitude lines
    for (let lon = 0; lon < Math.PI * 2; lon += Math.PI / 8) {
        const points = [];
        for (let lat = 0; lat <= Math.PI / 2; lat += Math.PI / 24) {
            const x = 4 * Math.sin(lat) * Math.cos(lon);
            const z = 4 * Math.sin(lat) * Math.sin(lon);
            const y = 4 * Math.cos(lat);
            points.push(new THREE.Vector3(x, y, z));
        }
        const geometry = new THREE.BufferGeometry().setFromPoints(points);
        const material = new THREE.LineBasicMaterial({ 
            color: 0x1a4d8f, 
            transparent: true, 
            opacity: 0.3 
        });
        const line = new THREE.Line(geometry, material);
        earthHemisphere.add(line);
    }
}

function createSatellite(color) {
    const satelliteGroup = new THREE.Group();
    
    // Satellite body (smaller for scale)
    const bodyGeometry = new THREE.BoxGeometry(0.3, 0.15, 0.15);
    const bodyMaterial = new THREE.MeshPhongMaterial({ 
        color: 0xcccccc,
        emissive: color,
        emissiveIntensity: 0.2
    });
    const body = new THREE.Mesh(bodyGeometry, bodyMaterial);
    satelliteGroup.add(body);

    // Solar panels
    const panelGeometry = new THREE.BoxGeometry(0.6, 0.02, 0.3);
    const panelMaterial = new THREE.MeshPhongMaterial({ 
        color: 0x1a4d8f,
        emissive: 0x0a1f3f
    });
    
    const leftPanel = new THREE.Mesh(panelGeometry, panelMaterial);
    leftPanel.position.x = -0.45;
    satelliteGroup.add(leftPanel);
    
    const rightPanel = new THREE.Mesh(panelGeometry, panelMaterial);
    rightPanel.position.x = 0.45;
    satelliteGroup.add(rightPanel);

    // Add a small glow sphere
    const glowGeometry = new THREE.SphereGeometry(0.15, 16, 16);
    const glowMaterial = new THREE.MeshBasicMaterial({ 
        color: color,
        transparent: true,
        opacity: 0.6
    });
    const glow = new THREE.Mesh(glowGeometry, glowMaterial);
    satelliteGroup.add(glow);

    return satelliteGroup;
}

function createPathArcs() {
    // Dashed arcs showing satellite paths
    for (let i = 0; i < 6; i++) {
        const angle = (i * Math.PI) / 6;
        const points = [];
        const radius = 6 + i * 0.5;
        
        for (let a = -Math.PI / 3; a <= Math.PI / 3; a += 0.1) {
            const x = radius * Math.cos(a) * Math.cos(angle);
            const y = radius * Math.sin(a);
            const z = radius * Math.cos(a) * Math.sin(angle);
            points.push(new THREE.Vector3(x, y, z));
        }
        
        const geometry = new THREE.BufferGeometry().setFromPoints(points);
        const material = new THREE.LineDashedMaterial({ 
            color: 0x667eea,
            dashSize: 0.2,
            gapSize: 0.1,
            transparent: true,
            opacity: 0.2
        });
        const line = new THREE.Line(geometry, material);
        line.computeLineDistances();
        scene.add(line);
    }
}

function createClouds() {
    for (let i = 0; i < 20; i++) {
        const cloudGeometry = new THREE.SphereGeometry(0.3, 8, 8);
        const cloudMaterial = new THREE.MeshBasicMaterial({ 
            color: 0xffffff,
            transparent: true,
            opacity: 0.4
        });
        const cloud = new THREE.Mesh(cloudGeometry, cloudMaterial);
        
        const angle = Math.random() * Math.PI * 2;
        const radius = 4.3;
        const height = Math.random() * 2;
        
        cloud.position.x = radius * Math.cos(angle);
        cloud.position.y = height;
        cloud.position.z = radius * Math.sin(angle);
        
        scene.add(cloud);
    }
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
    for (let i = 0; i < 2000; i++) {
        const x = (Math.random() - 0.5) * 100;
        const y = (Math.random() - 0.5) * 100;
        const z = (Math.random() - 0.5) * 50 - 25;
        starsVertices.push(x, y, z);
    }

    starsGeometry.setAttribute(
        'position',
        new THREE.Float32BufferAttribute(starsVertices, 3)
    );

    const stars = new THREE.Points(starsGeometry, starsMaterial);
    scene.add(stars);
}

function setupMouseControls(container) {
    container.addEventListener('mousedown', (e) => {
        isDragging = true;
        previousMousePosition = { x: e.clientX, y: e.clientY };
    });

    container.addEventListener('mousemove', (e) => {
        if (!isDragging) return;

        const deltaX = e.clientX - previousMousePosition.x;
        const deltaY = e.clientY - previousMousePosition.y;

        // Rotate entire scene slightly for better view
        scene.rotation.y += deltaX * 0.003;
        scene.rotation.x += deltaY * 0.003;
        
        // Limit rotation
        scene.rotation.x = Math.max(-0.3, Math.min(0.3, scene.rotation.x));

        previousMousePosition = { x: e.clientX, y: e.clientY };
    });

    container.addEventListener('mouseup', () => {
        isDragging = false;
    });

    container.addEventListener('mouseleave', () => {
        isDragging = false;
    });

    container.addEventListener('wheel', (e) => {
        e.preventDefault();
        camera.position.z += e.deltaY * 0.02;
        camera.position.z = Math.max(12, Math.min(30, camera.position.z));
    });
}

function resetCamera() {
    camera.position.set(0, 0, 20);
    camera.lookAt(0, 0, 0);
    scene.rotation.set(0, 0, 0);
}

function animate() {
    requestAnimationFrame(animate);

    // Slowly rotate Earth hemisphere
    earthHemisphere.rotation.z += 0.0005;

    // Animate satellites along their orbits
    satellites.forEach(satellite => {
        const data = satellite.userData;
        data.angle += data.speed;
        
        satellite.position.x = data.orbitRadius * Math.cos(data.angle);
        satellite.position.z = data.orbitRadius * Math.sin(data.angle) * Math.cos(data.tilt);
        satellite.position.y = data.orbitRadius * Math.sin(data.angle) * Math.sin(data.tilt);
        
        // Rotate satellite to face direction of travel
        satellite.rotation.y = -data.angle;
    });

    // Gently pulse orbit lines
    const pulseScale = 1 + Math.sin(Date.now() * 0.001) * 0.02;
    orbitLines.forEach(line => {
        line.scale.set(pulseScale, pulseScale, 1);
    });

    renderer.render(scene, camera);
}

function onWindowResize() {
    const container = document.getElementById('canvas-container');
    if (!container) return;

    camera.aspect = container.clientWidth / container.clientHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(container.clientWidth, container.clientHeight);
}

// ==================== EVENT LISTENERS ====================
window.addEventListener('scroll', () => {
    updateActiveNavLink();
    fadeInOnScroll();
});

document.addEventListener('DOMContentLoaded', () => {
    console.log('DOM Content Loaded');
    initFadeAnimations();
    fadeInOnScroll();
    
    // Initialize 3D model
    if (typeof THREE !== 'undefined') {
        init3DModel();
    } else {
        console.error('THREE.js not loaded');
    }
    
    // Add click handlers to nav links
    const navLinks = document.querySelectorAll('.nav-menu a');
    navLinks.forEach(link => {
        link.addEventListener('click', (e) => {
            e.preventDefault();
            const targetId = link.getAttribute('href').substring(1);
            scrollToSection(targetId);
        });
    });
});

// Export functions
window.LEOBusiness = {
    scrollToSection,
    updateActiveNavLink
};

console.log('All systems ready for LEO Business Challenge');
