function HygeoLoadingSpinnerEl() {
    if (HygeoLoadingSpinnerEl.INSTANCE) {
        return HygeoLoadingSpinnerEl.INSTANCE;
    }

    const overlayElId = 'hygeo-loading-overlay', spinnerElId = 'hygeo-loading-spinner';
    const size = 40; //seconds
    const border = 5; //seconds
    const stylesheetEl = document.createElement('style');
    document.head.appendChild(stylesheetEl);
    stylesheetEl.sheet.insertRule(`
        #${overlayElId} { 
            position: fixed; 
            width: 100vw; height: 100vh; top: 0; left: 0;
            z-index: 888888;
            background: rgb(200,200,200,.8);
            opacity: 1;
        }
    `);
    stylesheetEl.sheet.insertRule(`
        #${spinnerElId} {
            position: absolute; top:50%; left: 50%; 
            width: ${size}px; height: ${size}px; margin-top:-${size/2}px; margin-left:-${size/2}px; 
            border-style: dotted;
            border-width: ${border}px;
            border-color: blue red yellow green;
            border-radius: ${size}px; 
        }
    `);

    const overlayEl = document.createElement('div');
    overlayEl.id = overlayElId;
    const spinnerEl = document.createElement('div');
    spinnerEl.id = spinnerElId;
    overlayEl.appendChild(spinnerEl);

    let isFirstTime = true;
    const spinAnimation = {
        properties: { transform: ['rotate(0)', 'rotate(360deg)']},
        options: { duration: 4*1000, iterations: Infinity },
        instance: null
    }
    const fadeAnimation = {
        properties: { opacity: [0,1]},
        options: { duration: 1000},
        instance: null
    }

    let nextFrame = false;
    const start = () => {
        if (!document.body) {
            setTimeout(start, 100);
            return;
        }

        if (isFirstTime) {
            document.body.appendChild(overlayEl);
        }

        overlayEl.style.display = '';
        spinAnimation.instance = spinnerEl.animate(spinAnimation.properties, spinAnimation.options)
        fadeAnimation.instance = overlayEl.animate(fadeAnimation.properties, fadeAnimation.options);


        isFirstTime = false;
        return fadeAnimation.instance.finished;
    };

    const stop = () => {
        nextFrame = false;
        console.log('stop spinning')
        const existingAnimations = [];
        if (fadeAnimation.instance) {
            existingAnimations.push(fadeAnimation.instance);
        }
        if (spinAnimation.instance) {
            existingAnimations.push(spinAnimation.instance);
        }

        Promise.all(existingAnimations).then(() => {
            fadeAnimation.instance = overlayEl.animate(fadeAnimation.properties, {direction: 'reverse', ...fadeAnimation.options});
            fadeAnimation.instance.finished.then(() => overlayEl.style.display = 'none')
        })
    };

    HygeoLoadingSpinnerEl.INSTANCE = {
        start: start,
        stop: stop
    };

    return HygeoLoadingSpinnerEl.INSTANCE;
}