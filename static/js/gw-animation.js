// Gravitational Wave Animation for Dr. Stephen Taylor's website
// Animated binary black hole system with gravitational wave ripples

(function () {
    // Only run on home page
    if (!document.body.classList.contains('home-page')) return;

    const canvas = document.getElementById('gw-canvas');
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    let width, height;

    // Animation state
    let time = 0;
    const stars = [];
    const waves = [];
    const binaryAngle = { value: 0 };

    // Configuration
    const config = {
        starCount: 150,
        waveCount: 8,
        binaryRadius: 60,
        bhRadius: 12,
        orbitSpeed: 0.006,  // Slower orbit
        waveSpeed: 2,
        waveInterval: 60,
        // Bobbing motion parameters
        bobSpeedX: 0.0008,   // Slightly faster horizontal bobbing
        bobSpeedY: 0.001,    // Slightly faster vertical bobbing
        bobAmplitudeX: 150,  // How far it moves horizontally
        bobAmplitudeY: 80    // How far it moves vertically
    };

    function resize() {
        width = canvas.width = window.innerWidth;
        height = canvas.height = window.innerHeight;
        initStars();
    }

    function initStars() {
        stars.length = 0;
        for (let i = 0; i < config.starCount; i++) {
            stars.push({
                x: Math.random() * width,
                y: Math.random() * height,
                size: Math.random() * 2 + 0.5,
                twinkleSpeed: Math.random() * 0.02 + 0.01,
                twinkleOffset: Math.random() * Math.PI * 2
            });
        }
    }

    function drawStars() {
        stars.forEach(star => {
            const brightness = 0.3 + 0.7 * Math.abs(Math.sin(time * star.twinkleSpeed + star.twinkleOffset));
            ctx.beginPath();
            ctx.arc(star.x, star.y, star.size, 0, Math.PI * 2);
            ctx.fillStyle = `rgba(255, 255, 255, ${brightness})`;
            ctx.fill();
        });
    }

    function drawBinarySystem() {
        // Calculate bobbing offset for the whole system
        const bobOffsetX = Math.sin(time * config.bobSpeedX) * config.bobAmplitudeX;
        const bobOffsetY = Math.sin(time * config.bobSpeedY) * config.bobAmplitudeY;

        const cx = width / 2 + bobOffsetX;
        const cy = height / 2 - 50 + bobOffsetY;

        // Update orbital angle
        binaryAngle.value += config.orbitSpeed;

        // Black hole positions
        const bh1x = cx + Math.cos(binaryAngle.value) * config.binaryRadius;
        const bh1y = cy + Math.sin(binaryAngle.value) * config.binaryRadius;
        const bh2x = cx + Math.cos(binaryAngle.value + Math.PI) * config.binaryRadius;
        const bh2y = cy + Math.sin(binaryAngle.value + Math.PI) * config.binaryRadius;

        // Draw accretion disk glow for each BH
        [{ x: bh1x, y: bh1y }, { x: bh2x, y: bh2y }].forEach(bh => {
            // Outer glow
            const gradient = ctx.createRadialGradient(bh.x, bh.y, 0, bh.x, bh.y, config.bhRadius * 3);
            gradient.addColorStop(0, 'rgba(255, 150, 50, 0.4)');
            gradient.addColorStop(0.5, 'rgba(255, 100, 50, 0.2)');
            gradient.addColorStop(1, 'rgba(255, 50, 20, 0)');
            ctx.beginPath();
            ctx.arc(bh.x, bh.y, config.bhRadius * 3, 0, Math.PI * 2);
            ctx.fillStyle = gradient;
            ctx.fill();

            // Black hole core
            const coreGradient = ctx.createRadialGradient(bh.x, bh.y, 0, bh.x, bh.y, config.bhRadius);
            coreGradient.addColorStop(0, 'rgba(0, 0, 0, 1)');
            coreGradient.addColorStop(0.7, 'rgba(20, 20, 30, 1)');
            coreGradient.addColorStop(1, 'rgba(40, 40, 60, 0.8)');
            ctx.beginPath();
            ctx.arc(bh.x, bh.y, config.bhRadius, 0, Math.PI * 2);
            ctx.fillStyle = coreGradient;
            ctx.fill();
        });

        return { cx, cy };
    }

    function updateWaves(center) {
        // Add new wave periodically
        if (time % config.waveInterval === 0) {
            waves.push({
                x: center.cx,
                y: center.cy,
                radius: 20,
                opacity: 0.6
            });
        }

        // Update existing waves
        for (let i = waves.length - 1; i >= 0; i--) {
            const wave = waves[i];
            wave.radius += config.waveSpeed;
            wave.opacity -= 0.004;

            if (wave.opacity <= 0 || wave.radius > Math.max(width, height)) {
                waves.splice(i, 1);
            }
        }
    }

    function drawWaves() {
        waves.forEach(wave => {
            ctx.beginPath();
            ctx.arc(wave.x, wave.y, wave.radius, 0, Math.PI * 2);
            ctx.strokeStyle = `rgba(100, 150, 255, ${wave.opacity})`;
            ctx.lineWidth = 2;
            ctx.stroke();
        });
    }

    function animate() {
        // Clear canvas
        ctx.fillStyle = 'rgba(5, 5, 20, 1)';
        ctx.fillRect(0, 0, width, height);

        // Draw elements
        drawStars();
        const center = drawBinarySystem();
        updateWaves(center);
        drawWaves();

        time++;
        requestAnimationFrame(animate);
    }

    // Initialize
    window.addEventListener('resize', resize);
    resize();
    animate();
})();
