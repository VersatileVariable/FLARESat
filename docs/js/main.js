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
let scene, camera, renderer, satellite, earth, controls;
let isDragging = false;
let previousMousePosition = { x: 0, y: 0 };

function init3DModel() {
    const container = document.getElementById('canvas-container');
    if (!container) return;

    // Scene setup
    scene = new THREE.Scene();
    scene.background = new THREE.Color(0x0a0a1e);

    // Camera setup
    camera = new THREE.PerspectiveCamera(
        75,
        container.clientWidth / container.clientHeight,
        0.1,
        1000
    );
    camera.position.z = 15;

    // Renderer setup
    renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setSize(container.clientWidth, container.clientHeight);
    renderer.setPixelRatio(window.devicePixelRatio);
    container.appendChild(renderer.domElement);

    // Lights
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.5);
    scene.add(ambientLight);

    const directionalLight = new THREE.DirectionalLight(0xffffff, 0.8);
    directionalLight.position.set(5, 5, 5);
    scene.add(directionalLight);

    const pointLight = new THREE.PointLight(0x667eea, 1, 100);
    pointLight.position.set(-5, 5, 5);
    scene.add(pointLight);

    // Create Earth
    const earthGeometry = new THREE.SphereGeometry(3, 32, 32);
    const earthMaterial = new THREE.MeshPhongMaterial({
        color: 0x2233aa,
        emissive: 0x112244,
        shininess: 25
    });
    earth = new THREE.Mesh(earthGeometry, earthMaterial);
    scene.add(earth);

    // Add atmosphere glow
    const atmosphereGeometry = new THREE.SphereGeometry(3.1, 32, 32);
    const atmosphereMaterial = new THREE.MeshBasicMaterial({
        color: 0x667eea,
        transparent: true,
        opacity: 0.2,
        side: THREE.BackSide
    });
    const atmosphere = new THREE.Mesh(atmosphereGeometry, atmosphereMaterial);
    earth.add(atmosphere);

    // Create Satellite
    const satelliteGroup = new THREE.Group();
    
    // Satellite body
    const bodyGeometry = new THREE.BoxGeometry(1, 0.5, 0.5);
    const bodyMaterial = new THREE.MeshPhongMaterial({ color: 0xcccccc });
    const body = new THREE.Mesh(bodyGeometry, bodyMaterial);
    satelliteGroup.add(body);

    // Solar panels
    const panelGeometry = new THREE.BoxGeometry(2, 0.05, 1);
    const panelMaterial = new THREE.MeshPhongMaterial({ 
        color: 0x1a4d8f,
        emissive: 0x0a1f3f
    });
    
    const leftPanel = new THREE.Mesh(panelGeometry, panelMaterial);
    leftPanel.position.x = -1.5;
    satelliteGroup.add(leftPanel);
    
    const rightPanel = new THREE.Mesh(panelGeometry, panelMaterial);
    rightPanel.position.x = 1.5;
    satelliteGroup.add(rightPanel);

    // Antenna
    const antennaGeometry = new THREE.CylinderGeometry(0.05, 0.05, 1, 8);
    const antennaMaterial = new THREE.MeshPhongMaterial({ color: 0x888888 });
    const antenna = new THREE.Mesh(antennaGeometry, antennaMaterial);
    antenna.position.y = 0.75;
    satelliteGroup.add(antenna);

    satellite = satelliteGroup;
    satellite.position.set(6, 2, 0);
    scene.add(satellite);

    // Create orbit path
    const orbitGeometry = new THREE.TorusGeometry(6.5, 0.02, 16, 100);
    const orbitMaterial = new THREE.MeshBasicMaterial({ 
        color: 0x667eea,
        transparent: true,
        opacity: 0.3
    });
    const orbit = new THREE.Mesh(orbitGeometry, orbitMaterial);
    orbit.rotation.x = Math.PI / 2;
    scene.add(orbit);

    // Stars background
    createStars();

    // Mouse controls
    setupMouseControls(container);

    // Reset button
    document.getElementById('reset-view').addEventListener('click', resetCamera);

    // Handle window resize
    window.addEventListener('resize', onWindowResize);

    // Start animation
    animate();
}

function createStars() {
    const starsGeometry = new THREE.BufferGeometry();
    const starsMaterial = new THREE.PointsMaterial({ 
        color: 0xffffff, 
        size: 0.1 
    });

    const starsVertices = [];
    for (let i = 0; i < 1000; i++) {
        const x = (Math.random() - 0.5) * 100;
        const y = (Math.random() - 0.5) * 100;
        const z = (Math.random() - 0.5) * 100;
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

        earth.rotation.y += deltaX * 0.005;
        earth.rotation.x += deltaY * 0.005;

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
        camera.position.z += e.deltaY * 0.01;
        camera.position.z = Math.max(8, Math.min(25, camera.position.z));
    });
}

function resetCamera() {
    camera.position.set(0, 0, 15);
    earth.rotation.set(0, 0, 0);
}

function animate() {
    requestAnimationFrame(animate);

    // Rotate Earth slowly
    earth.rotation.y += 0.001;

    // Orbit satellite around Earth
    const time = Date.now() * 0.0005;
    satellite.position.x = Math.cos(time) * 6.5;
    satellite.position.z = Math.sin(time) * 6.5;
    satellite.position.y = Math.sin(time * 0.5) * 2;
    
    // Rotate satellite to face forward in orbit
    satellite.rotation.y = -time;

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
