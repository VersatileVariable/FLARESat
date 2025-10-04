// Fire simulation system
function initFireSimulation(scene) {
    const fires = [];
    const MAX_FIRES = 8;
    
    function createFire() {
        // Random position on sphere
        const radius = 10.1; // Slightly above Earth's surface
        const latitude = Math.random() * 180 - 90;
        const longitude = Math.random() * 360 - 180;
        
        const phi = (90 - latitude) * (Math.PI / 180);
        const theta = (longitude + 180) * (Math.PI / 180);
        
        const x = radius * Math.sin(phi) * Math.cos(theta);
        const y = (radius * Math.cos(phi)) - 25; // Adjust for Earth's position
        const z = radius * Math.sin(phi) * Math.sin(theta);
        
        // Create fire marker (red dot)
        const fireGeometry = new THREE.SphereGeometry(0.2, 16, 16);
        const fireMaterial = new THREE.MeshBasicMaterial({
            color: 0xff3333,
            transparent: true,
            opacity: 1
        });
        const fireMarker = new THREE.Mesh(fireGeometry, fireMaterial);
        fireMarker.position.set(x, y, z);
        
        // Add glow effect
        const glowGeometry = new THREE.SphereGeometry(0.4, 16, 16);
        const glowMaterial = new THREE.MeshBasicMaterial({
            color: 0xff6666,
            transparent: true,
            opacity: 0.5
        });
        const glow = new THREE.Mesh(glowGeometry, glowMaterial);
        glow.position.set(x, y, z);
        
        scene.add(fireMarker);
        scene.add(glow);
        
        return {
            marker: fireMarker,
            glow: glow,
            life: Math.random() * 3 + 2, // Random lifespan between 2-5 seconds
            age: 0
        };
    }

    function update(delta) {
        // Remove dead fires
        for (let i = fires.length - 1; i >= 0; i--) {
            const fire = fires[i];
            fire.age += delta;
            
            if (fire.age >= fire.life) {
                scene.remove(fire.marker);
                scene.remove(fire.glow);
                fires.splice(i, 1);
            } else {
                // Pulse the fire opacity
                const opacity = Math.sin((fire.age * Math.PI * 2) / fire.life) * 0.5 + 0.5;
                fire.marker.material.opacity = opacity;
                fire.glow.material.opacity = opacity * 0.3;
            }
        }
        
        // Add new fires randomly
        if (fires.length < MAX_FIRES && Math.random() < 0.05) {
            fires.push(createFire());
        }
    }

    return { update };
}