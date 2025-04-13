window.addEventListener("DOMContentLoaded", () => {
    const canvas = document.getElementById("canvas");
    const ctx = canvas.getContext("2d");

    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
    canvas.style.position = 'fixed';
    canvas.style.top = '0';
    canvas.style.left = '0';

    const NEUTRON_SPEED = 2;
    const ELECTRON_SPEED = 5;
    const COOLING_RATE = 1;
    const EVAPORATION_TEMP = 100;
    const PARTICLE_HEAT_TRANSFER = 1;
    const MELTDOWN_TEMP = 1132;
    const MELTDOWN_SPREAD_RATE = 0.5;
    const WATER_REFILL_RATE = 0.5;
    const MAX_WATER_TEMP = 80;
    const WATER_COOLING_RATE = 0.95;
    const WATER_TEMP_PERSISTENCE = 0.8;
    const WATER_COOLING_DELAY = 0.1


    const NEUTRON_ABSORPTION_CHANCE = 0.003;
    const UNREACTIVE_EMISSION_CHANCE = 0.0001;
    const REACTIVATION_CHANCE = 0.01;//fuel rod 
    const URANIUM_COLOR = "#2ea4f2";
    const SPENT_URANIUM_COLOR = "#888888";
    const FAST_NEUTRON_SPEED = 5; // Faster than regular neutrons
    const FAST_NEUTRON_COLOR = "#4827c2";
    const FAST_NEUTRON_SLOWDOWN_RATE = 0.0085; // How quickly fast neutrons slow down in water
    const FAST_NEUTRON_CONVERSION_CHANCE = 1;

    // Control rod constants
    const CONTROL_ROD_SPACING = 4;
    const CONTROL_ROD_WIDTH = 6;
    const CONTROL_ROD_COLOR = "#333";
    const CONTROL_ROD_ABSORPTION_CHANCE = 0.8;
    const ROD_RETRACTED_HEIGHT_RATIO = 0.2; // 20% height when retracted

    const MODERATOR_SPACING = 4; // Same spacing as control rods
    const MODERATOR_WIDTH = 6;
    const MODERATOR_COLOR = "#d6c1db"; // Green color for moderators
    const MODERATOR_BOUNCE_EFFICIENCY = 0.8;
    const MODERATOR_RETRACTED_HEIGHT_RATIO = 0.2;

    const BASE_TEMP = 20; // Ambient temperature
    const MAX_TEMP = 4000; // Maximum possible core temp
    const TEMP_NORMALIZATION = 0.3; // Smoothing factor for temp changes
    const TEMP_NEUTRON_WEIGHT = 0.4; // How much neutrons affect temp
    const TEMP_WATER_WEIGHT = 0.3; // How much water cooling affects temp
    const TEMP_MELTDOWN_WEIGHT = 0.3; // How much meltdowns affect temp

    class Reactor {
        static chambers = [];
        static elements = [];
        static particles = [];
        static meltdownChambers = [];
        static temperature = 20;
        static controlRods = [];

        static init() {
            this.drawPlatform();
            this.setupElements();

            // Add initial neutrons
            for (let i = 0; i < 5; i++) {
                const randomElement = this.elements[Math.floor(Math.random() * this.elements.length)];
                const angle = Math.random() * Math.PI * 2;
                this.particles.push({
                    x: randomElement.x,
                    y: randomElement.y,
                    dx: Math.cos(angle) * NEUTRON_SPEED,
                    dy: Math.sin(angle) * NEUTRON_SPEED,
                    type: 'neutron',
                    sourceElement: randomElement
                });
            }

            this.startSimulation();
        }

        static drawPlatform() {
            const platformWidth = 1000;
            const platformHeight = 700;
            const platformMargin = 20;
            const chamberSize = 31;
            const chamberMargin = 3;

            const platformX = Math.round((canvas.width - platformWidth) / 2);
            const platformY = Math.round((canvas.height - platformHeight) / 2);

            // Reactor vessel
            ctx.fillStyle = "rgba(50, 50, 50, 0.8)";
            ctx.fillRect(platformX, platformY, platformWidth, platformHeight);

            // Create chambers
            const gridWidth = platformWidth - (platformMargin * 2);
            const gridHeight = platformHeight - (platformMargin * 2);
            const chambersPerRow = Math.floor((gridWidth + chamberMargin) / (chamberSize + chamberMargin));
            const chambersPerCol = Math.floor((gridHeight + chamberMargin) / (chamberSize + chamberMargin));

            const startX = platformX + platformMargin;
            const startY = platformY + platformMargin;

            this.controlRods = [];
            this.moderatorRods = [];

            for (let row = 0; row < chambersPerCol; row++) {
                for (let col = 0; col < chambersPerRow; col++) {
                    const x = startX + col * (chamberSize + chamberMargin);
                    const y = startY + row * (chamberSize + chamberMargin);
                    const id = `${row}-${col}`;

                    this.chambers.push({
                        x, y, width: chamberSize, height: chamberSize,
                        row, col, id,
                        waterLevel: 100,
                        temperature: 20
                    });

                    // Add control rod after every CONTROL_ROD_SPACING chambers
                    if (col > 0 && col % CONTROL_ROD_SPACING === 2) {
                        const controlRodX = x - chamberMargin / 2 - CONTROL_ROD_WIDTH / 2;
                        this.controlRods.push({
                            x: controlRodX,
                            y: platformY + platformMargin,
                            width: CONTROL_ROD_WIDTH,
                            maxHeight: platformHeight - (platformMargin * 2),
                            currentHeight: platformHeight - (platformMargin * 2),
                            inserted: true
                        });
                    }
                    if (col % MODERATOR_SPACING === 3) {
                        const moderatorRodX = x + chamberSize + chamberMargin / 2 - MODERATOR_WIDTH / 2;
                        this.moderatorRods.push({
                            x: moderatorRodX,
                            y: platformY + platformMargin,
                            width: MODERATOR_WIDTH,
                            maxHeight: platformHeight - (platformMargin * 2), // Add this line
                            currentHeight: platformHeight - (platformMargin * 2), // Changed from 'height'
                            inserted: true
                        });
                    }
                }
            }
        }

        static setupElements() {
            this.chambers.forEach(chamber => {
                this.elements.push({
                    x: chamber.x + chamber.width / 2,
                    y: chamber.y + chamber.height / 2,
                    radius: chamber.width / 3,
                    temperature: 20,
                    chamberId: chamber.id,
                    neutronsEmitted: 0,
                    color: URANIUM_COLOR,
                    melted: false,
                    reactive: false,
                    timeSinceDeactivation: 0
                });
            });
        }

        static drawWater() {
            this.chambers.forEach(chamber => {
                const tempRatio = Math.min(1, chamber.temperature / 100);
                const baseColor = { r: 214, g: 239, b: 255 };
                const hotColor = { r: 227, g: 120, b: 120 };

                const r = Math.floor(baseColor.r + (hotColor.r - baseColor.r) * tempRatio);
                const g = Math.floor(baseColor.g + (hotColor.g - baseColor.g) * tempRatio);
                const b = Math.floor(baseColor.b + (hotColor.b - baseColor.b) * tempRatio);

                if (chamber.waterLevel > 5) {
                    const waterHeight = (chamber.waterLevel / 100) * chamber.height;
                    ctx.fillStyle = `rgba(${r}, ${g}, ${b}, 0.7)`;
                    ctx.fillRect(
                        chamber.x,
                        chamber.y + chamber.height - waterHeight,
                        chamber.width,
                        waterHeight
                    );
                }
            });
        }

        static drawControlRods() {
            ctx.fillStyle = CONTROL_ROD_COLOR;
            this.controlRods.forEach(rod => {
                const drawHeight = rod.inserted ? rod.currentHeight : rod.maxHeight * ROD_RETRACTED_HEIGHT_RATIO;
                const drawY = rod.inserted ? rod.y : rod.y + rod.maxHeight - drawHeight;
                ctx.fillRect(rod.x, drawY, rod.width, drawHeight);
            });
        }
        static drawModeratorRods() {
            ctx.fillStyle = MODERATOR_COLOR;
            this.moderatorRods.forEach(rod => {
                const drawHeight = rod.inserted ? rod.currentHeight : rod.maxHeight * MODERATOR_RETRACTED_HEIGHT_RATIO;
                const drawY = rod.inserted ? rod.y : rod.y + rod.maxHeight - drawHeight;
                ctx.fillRect(rod.x, drawY, rod.width, drawHeight);
                ctx.strokeStyle = "#5c5c5c";
                ctx.strokeRect(rod.x, drawY, rod.width, drawHeight);
            });
        }
        static drawElements() {
            this.elements.forEach(element => {
                const chamber = this.chambers.find(c => c.id === element.chamberId);
                const hasWater = chamber && chamber.waterLevel > 5;

                if (element.melted) {
                    ctx.fillStyle = "rgba(255, 100, 0, 0.7)";
                }
                else if (!element.reactive) {
                    ctx.fillStyle = SPENT_URANIUM_COLOR;
                }
                else if (!hasWater && element.temperature > 20) {
                    const tempRatio = Math.min(1, (element.temperature - 20) / (1132 - 20));
                    const baseColor = hexToRgb(URANIUM_COLOR);
                    const hotColor = { r: 255, g: 100, b: 0 };

                    const r = Math.floor(baseColor.r + (hotColor.r - baseColor.r) * tempRatio);
                    const g = Math.floor(baseColor.g + (hotColor.g - baseColor.g) * tempRatio);
                    const b = Math.floor(baseColor.b + (hotColor.b - baseColor.b) * tempRatio);

                    ctx.fillStyle = `rgb(${r}, ${g}, ${b})`;
                }
                else {
                    ctx.fillStyle = URANIUM_COLOR;
                }

                ctx.beginPath();
                ctx.arc(element.x, element.y, element.radius, 0, Math.PI * 2);
                ctx.fill();
            });

            function hexToRgb(hex) {
                const r = parseInt(hex.slice(1, 3), 16);
                const g = parseInt(hex.slice(3, 5), 16);
                const b = parseInt(hex.slice(5, 7), 16);
                return { r, g, b };
            }
        }

        static simulatePhysics() {
            this.controlRods.forEach(rod => {
                const targetHeight = rod.inserted ? rod.maxHeight : rod.maxHeight * ROD_RETRACTED_HEIGHT_RATIO;
                rod.currentHeight += (targetHeight - rod.currentHeight) * 0.1;
            });

            this.elements.forEach(element => {
                element.temperature += element.neutronsEmitted * 0.1;
                element.neutronsEmitted = 0;

                if (element.temperature >= MELTDOWN_TEMP && !element.melted) {
                    element.melted = true;
                    this.meltdownChambers.push(element.chamberId);
                    const chamber = this.chambers.find(c => c.id === element.chamberId);
                    if (chamber) chamber.waterLevel = 0;
                }
                if (this.temperature > MELTDOWN_TEMP && this.meltdownChambers.length === 0) {
                    const hottestElements = this.elements
                        .filter(el => !el.melted)
                        .sort((a, b) => b.temperature - a.temperature)
                        .slice(0, 3); // Start meltdown in 3 hottest elements

                    hottestElements.forEach(element => {
                        element.melted = true;
                        this.meltdownChambers.push(element.chamberId);
                        const chamber = this.chambers.find(c => c.id === element.chamberId);
                        if (chamber) chamber.waterLevel = 0;
                    });
                }

                if (!element.reactive && !element.melted) {
                    element.timeSinceDeactivation++;

                    if (Math.random() < UNREACTIVE_EMISSION_CHANCE) {
                        const angle = Math.random() * Math.PI * 2;
                        this.particles.push({
                            x: element.x,
                            y: element.y,
                            dx: Math.cos(angle) * NEUTRON_SPEED,
                            dy: Math.sin(angle) * NEUTRON_SPEED,
                            type: 'neutron',
                            sourceElement: element
                        });
                    }

                    if (Math.random() < REACTIVATION_CHANCE) {
                        element.reactive = true;
                        element.color = URANIUM_COLOR;
                        element.timeSinceDeactivation = 0;
                    }
                }

                const chamber = this.chambers.find(c => c.id === element.chamberId);
                if (chamber) {
                    const heatTransferRate = chamber.waterLevel > 5 ? 0.1 : 0.01;
                    chamber.temperature += (element.temperature - chamber.temperature) * heatTransferRate;
                }
            });

            // Particle updates...
            this.particles.forEach(particle => {
                particle.x += particle.dx;
                particle.y += particle.dy;

                if (particle.type === 'fast_neutron') {
                    const currentChamber = this.chambers.find(chamber =>
                        particle.x >= chamber.x && particle.x <= chamber.x + chamber.width &&
                        particle.y >= chamber.y && particle.y <= chamber.y + chamber.height
                    );

                    if (currentChamber && currentChamber.waterLevel > 5) {
                        // Gradually slow down in water
                        particle.dx *= (1 - FAST_NEUTRON_SLOWDOWN_RATE);
                        particle.dy *= (1 - FAST_NEUTRON_SLOWDOWN_RATE);

                        // Calculate current speed
                        const currentSpeed = Math.sqrt(particle.dx ** 2 + particle.dy ** 2);

                        // Automatically convert when slowed down enough
                        if (currentSpeed <= NEUTRON_SPEED * 1.2) { // When close to normal speed
                            particle.type = 'neutron';
                            // Normalize to exact neutron speed
                            if (currentSpeed > 0) {
                                const ratio = NEUTRON_SPEED / currentSpeed;
                                particle.dx *= ratio;
                                particle.dy *= ratio;
                            }
                        }
                    }
                }
            });
            const particlesToRemove = new Set();
            const newParticles = [];

            this.particles.forEach((particle, index) => {
                if (particle.x < 0 || particle.x > canvas.width ||
                    particle.y < 0 || particle.y > canvas.height) {
                    particlesToRemove.add(index);
                    return;
                }

                // Check control rod collisions (only if inserted)
                for (const rod of this.controlRods) {
                    if (rod.inserted &&
                        particle.x >= rod.x && particle.x <= rod.x + rod.width &&
                        particle.y >= rod.y && particle.y <= rod.y + rod.currentHeight &&
                        particle.type === 'neutron') {
                        if (Math.random() < CONTROL_ROD_ABSORPTION_CHANCE) {
                            particlesToRemove.add(index);
                            return;
                        }
                    }
                }
                // In simulatePhysics(), modify the moderator collision code to:
                for (const moderator of this.moderatorRods) {
                    // Only process if moderator is inserted
                    if (moderator.inserted &&
                        particle.x >= moderator.x && particle.x <= moderator.x + moderator.width &&
                        particle.y >= moderator.y && particle.y <= moderator.y + moderator.currentHeight) {

                        if (particle.type === 'fast_neutron') {
                            // Convert to normal neutron first
                            particle.type = 'neutron';

                            // Calculate normal vector based on which side was hit
                            let normalX = 0, normalY = 0;
                            const leftDist = particle.x - moderator.x;
                            const rightDist = (moderator.x + moderator.width) - particle.x;
                            const topDist = particle.y - moderator.y;
                            const bottomDist = (moderator.y + moderator.currentHeight) - particle.y;

                            // Find closest side
                            const minDist = Math.min(leftDist, rightDist, topDist, bottomDist);

                            if (minDist === leftDist) normalX = -1;
                            else if (minDist === rightDist) normalX = 1;
                            else if (minDist === topDist) normalY = -1;
                            else normalY = 1;

                            // Calculate reflection vector (R = I - 2(I·N)N)
                            const dot = particle.dx * normalX + particle.dy * normalY;
                            particle.dx = MODERATOR_BOUNCE_EFFICIENCY * (particle.dx - 2 * dot * normalX);
                            particle.dy = MODERATOR_BOUNCE_EFFICIENCY * (particle.dy - 2 * dot * normalY);

                            // Add randomness to simulate surface imperfection
                            const randomness = 0.1;
                            particle.dx += (Math.random() - 0.5) * randomness * FAST_NEUTRON_SPEED;
                            particle.dy += (Math.random() - 0.5) * randomness * FAST_NEUTRON_SPEED;

                            // Normalize speed
                            const speed = Math.sqrt(particle.dx ** 2 + particle.dy ** 2);
                            const ratio = NEUTRON_SPEED / speed;
                            particle.dx *= ratio;
                            particle.dy *= ratio;

                            // Adjust position to prevent sticking
                            particle.x += particle.dx * 0.1;
                            particle.y += particle.dy * 0.1;

                            break;
                        }
                    }
                }
                this.moderatorRods.forEach(rod => {
                    const targetHeight = rod.inserted ? rod.maxHeight : rod.maxHeight * MODERATOR_RETRACTED_HEIGHT_RATIO;
                    rod.currentHeight += (targetHeight - rod.currentHeight) * 0.1;
                });

                // Rest of collision detection...
                const currentChamber = this.chambers.find(chamber =>
                    particle.x >= chamber.x && particle.x <= chamber.x + chamber.width &&
                    particle.y >= chamber.y && particle.y <= chamber.y + chamber.height
                );

                if (currentChamber) {
                    if (currentChamber.waterLevel > 5) {
                        if (particle.type === 'neutron' && Math.random() < NEUTRON_ABSORPTION_CHANCE) {
                            particlesToRemove.add(index);
                            currentChamber.temperature += PARTICLE_HEAT_TRANSFER * 3;
                            return;
                        }
                        currentChamber.temperature += PARTICLE_HEAT_TRANSFER * 2;
                    } else {
                        currentChamber.temperature += PARTICLE_HEAT_TRANSFER * 0.5;
                    }
                }

                for (const element of this.elements) {
                    if (particle.type === 'neutron') {
                        const dx = particle.x - element.x;
                        const dy = particle.y - element.y;
                        const distance = Math.sqrt(dx * dx + dy * dy);

                        if (distance < element.radius && element !== particle.sourceElement && element.reactive) {
                            // Create 1 fast neutron instead of regular neutrons
                            for (let i = 0; i < 3; i++) {
                                const angle = Math.random() * Math.PI * 2;
                                newParticles.push({
                                    x: element.x,
                                    y: element.y,
                                    dx: Math.cos(angle) * FAST_NEUTRON_SPEED,
                                    dy: Math.sin(angle) * FAST_NEUTRON_SPEED,
                                    type: 'fast_neutron',
                                    sourceElement: element
                                });
                            }

                            element.neutronsEmitted += 1;
                            element.temperature += 3;
                            element.reactive = false;
                            element.color = SPENT_URANIUM_COLOR;
                            element.timeSinceDeactivation = 0;

                            particlesToRemove.add(index);
                            break;
                        }
                    }
                }
            });

            this.particles = this.particles.filter((_, index) => !particlesToRemove.has(index));
            this.particles.push(...newParticles);

            this.chambers.forEach(chamber => {
                chamber.temperature = Math.max(20, chamber.temperature * COOLING_RATE);

                if (chamber.temperature > EVAPORATION_TEMP) {
                    const evaporationRate = 1 - (0.01 * (chamber.temperature - EVAPORATION_TEMP) / 50);
                    chamber.waterLevel *= evaporationRate;
                } else if (chamber.waterLevel < 100) {
                    chamber.waterLevel = Math.min(100, chamber.waterLevel + 0.5);
                }

                const element = this.elements.find(e => e.chamberId === chamber.id);
                if (element && chamber.waterLevel > 5) {
                    const coolingEffectiveness = 0.9 + (chamber.waterLevel / 100 * 0.1);
                    element.temperature = Math.max(20, element.temperature * coolingEffectiveness);
                }

                chamber.waterLevel = Math.max(0, Math.min(100, chamber.waterLevel));
                chamber.temperature = Math.max(20, Math.min(1000, chamber.temperature));
            });

            const activeElements = this.elements.filter(el => el.reactive && !el.melted);
            const activeChambers = this.chambers.filter(c => c.waterLevel > 5);

            // Calculate temperature components
            const elementTemp = activeElements.length > 0 ?
                activeElements.reduce((sum, el) => sum + el.temperature, 0) / activeElements.length :
                BASE_TEMP;

            const neutronFactor = 1 + (this.particles.filter(p => p.type === 'neutron').length / 100);
            const waterCooling = activeChambers.length > 0 ?
                activeChambers.reduce((sum, c) => sum + (MAX_WATER_TEMP - c.temperature), 0) /
                (activeChambers.length * MAX_WATER_TEMP) :
                1;

            const meltdownFactor = 1 + (this.meltdownChambers.length * 0.2);

            // Weighted temperature calculation
            const rawTemp = (
                (elementTemp * TEMP_NEUTRON_WEIGHT * neutronFactor) +
                (elementTemp * TEMP_WATER_WEIGHT * waterCooling) +
                (elementTemp * TEMP_MELTDOWN_WEIGHT * meltdownFactor)
            );

            // Smooth temperature changes
            this.temperature = BASE_TEMP +
                (rawTemp - BASE_TEMP) * TEMP_NORMALIZATION +
                (this.temperature - BASE_TEMP) * (1 - TEMP_NORMALIZATION);

            // Clamp to reasonable values
            this.temperature = Math.max(BASE_TEMP, Math.min(MAX_TEMP, this.temperature));
        }

        static drawParticles() {
            this.particles.forEach((particle, index) => {
                if (particle.type === 'smoke') {
                    let rad = 4 + (150 - particle.lifetime) / 20
                    ctx.fillStyle = `rgba(100, 100, 100, ${particle.lifetime / 150})`;
                    ctx.beginPath();
                    ctx.arc(particle.x, particle.y, rad < 0 ? 0 : rad, 0, Math.PI * 2);
                    ctx.fill();

                    particle.lifetime--;
                    if (particle.lifetime <= 0) {
                        this.particles.splice(index, 1);
                    }
                } else {
                    let color, size;
                    if (particle.type === 'neutron') {
                        color = '#171715'; // Black for regular neutrons
                        size = 4;
                    } else if (particle.type === 'fast_neutron') {
                        color = FAST_NEUTRON_COLOR; // Red for fast neutrons
                        size = 3; // Slightly smaller
                    }

                    ctx.fillStyle = color;
                    ctx.beginPath();
                    ctx.arc(particle.x, particle.y, size, 0, Math.PI * 2);
                    ctx.fill();
                }
            });
        }

        static drawMeltdown() {
            // Calculate overall meltdown severity
            const severity = Math.min(1, this.temperature / 3000);

            this.meltdownChambers.forEach(chamberId => {
                const chamber = this.chambers.find(c => c.id === chamberId);
                const element = this.elements.find(e => e.chamberId === chamberId);

                if (chamber && element) {
                    // Glowing core effect
                    ctx.fillStyle = `rgba(255, ${100 + severity * 155}, 0, ${0.5 + severity * 0.3})`;
                    ctx.beginPath();
                    ctx.arc(element.x, element.y, element.radius * (1.5 + severity), 0, Math.PI * 2);
                    ctx.fill();

                    // Chamber breach effect
                    ctx.strokeStyle = `rgba(255, ${50 + severity * 205}, 0, ${0.7 + severity * 0.2})`;
                    ctx.lineWidth = 2 + severity * 3;
                    ctx.strokeRect(
                        chamber.x + 5 - severity * 5,
                        chamber.y + 5 - severity * 5,
                        chamber.width - 10 + severity * 10,
                        chamber.height - 10 + severity * 10
                    );

                    // More intense smoke during severe meltdowns
                    if (Math.random() > (0.7 - severity * 0.2)) {
                        const smokeSize = 3 + severity * 5;
                        this.particles.push({
                            x: element.x + (Math.random() - 0.5) * 10,
                            y: element.y + (Math.random() - 0.5) * 10,
                            dx: (Math.random() - 0.5) * (0.5 + severity),
                            dy: -Math.random() * (2 + severity * 3),
                            type: 'smoke',
                            lifetime: 150 + Math.random() * 100
                        });
                    }

                    // Spark effects during high-temperature meltdowns
                    if (severity > 0.5 && Math.random() > 0.8) {
                        for (let i = 0; i < 3; i++) {
                            this.particles.push({
                                x: element.x,
                                y: element.y,
                                dx: (Math.random() - 0.5) * 3,
                                dy: (Math.random() - 0.5) * 3,
                                type: 'spark',
                                lifetime: 30 + Math.random() * 20,
                                size: 1 + Math.random() * 2
                            });
                        }
                    }
                }
            });
        }

        static spreadMeltdown(chamber) {
            const neighbors = this.chambers.filter(c =>
            (Math.abs(c.row - chamber.row) <= 1 &&
                Math.abs(c.col - chamber.col) <= 1 &&
                c.id !== chamber.id
            ));

            neighbors.forEach(neighbor => {
                const element = this.elements.find(e => e.chamberId === neighbor.id);
                if (element) {
                    element.temperature += MELTDOWN_SPREAD_RATE * (MELTDOWN_TEMP - element.temperature);
                }
            });
        }

        static drawStatus() {
            ctx.fillStyle = 'black';
            ctx.font = '16px Arial';
            ctx.fillText(`Core Temperature: ${this.temperature.toFixed(1)}°C`, 20, 30);
            ctx.fillText(`Active Particles: ${this.particles.length}`, 20, 60);
            ctx.fillText(`Water Chambers: ${this.chambers.filter(c => c.waterLevel > 5).length}/${this.chambers.length}`, 20, 90);

            const insertedRods = this.controlRods.filter(rod => rod.inserted).length;
            ctx.fillText(`Control Rods: ${insertedRods}/${this.controlRods.length} inserted`, 20, 120);
            const insertedModerators = this.moderatorRods.filter(rod => rod.inserted).length;
            ctx.fillText(`Moderators: ${insertedModerators}/${this.moderatorRods.length} inserted`, 20, 150);
            ctx.fillText(`(Press 'm' to toggle moderators, 'c' for control rods)`, 20, 180);

            if (this.temperature > 500) {
                ctx.fillStyle = 'red';
                ctx.font = '24px Arial';
                ctx.fillText('CRITICAL TEMPERATURE!', canvas.width - 250, 30);
            }
        }

        static startSimulation() {
            const loop = () => {
                ctx.fillStyle = 'rgba(255, 255, 255, 0.1)';
                ctx.fillRect(0, 0, canvas.width, canvas.height);


                this.simulatePhysics();
                this.drawWater();
                this.drawControlRods(); // Draw rods after water but before elements
                this.drawModeratorRods();
                this.drawElements();
                this.drawParticles();
                this.drawMeltdown();
                this.drawStatus();

                if (this.meltdownChambers.length > 0) {
                    ctx.fillStyle = 'rgba(255, 0, 0, 0.5)';
                    ctx.fillRect(0, 0, canvas.width, canvas.height);
                    ctx.fillStyle = 'white';
                    ctx.font = 'bold 48px Arial';
                    ctx.textAlign = 'center';
                    ctx.fillText('MELTDOWN IN PROGRESS!', canvas.width / 2, canvas.height / 2);
                    ctx.font = '24px Arial';
                    ctx.fillText(`${this.meltdownChambers.length} fuel elements breached`, canvas.width / 2, canvas.height / 2 + 40);
                }

                requestAnimationFrame(loop);
            };

            loop();
        }
    }

    Reactor.init();

    document.addEventListener('keydown', (e) => {
        if (e.key === 'ArrowUp') {
            Reactor.elements.forEach(el => el.stability = Math.max(0.1, el.stability - 0.05));
        } else if (e.key === 'ArrowDown') {
            Reactor.elements.forEach(el => el.stability = Math.min(0.95, el.stability + 0.05));
        } else if (e.key === 'm') { // Toggle moderators only
            Reactor.moderatorRods.forEach(rod => rod.inserted = !rod.inserted);
        } else if (e.key === 'c') { // Toggle control rods only
            Reactor.controlRods.forEach(rod => rod.inserted = !rod.inserted);
        }
    });
});
