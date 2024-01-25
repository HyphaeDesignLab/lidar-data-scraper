function HygeoLoadingSpinnerEl() {
    if (HygeoLoadingSpinnerEl.INSTANCE) {
        return HygeoLoadingSpinnerEl.INSTANCE;
    }

    const overlayElId = 'hygeo-loading-overlay', spinnerElId = 'hygeo-loading-spinner';
    const spinningTime = 10; //seconds
    const stopFadeoutTime = 2; //seconds
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
            transition: opacity ${stopFadeoutTime}s ease-in;
            opacity: 1;
        }
    `);
    stylesheetEl.sheet.insertRule(`
        #${overlayElId}.fading { 
            opacity: 0;
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
            transition: transform ${spinningTime}s ease-out;
        }
    `);
    stylesheetEl.sheet.insertRule(`
        #${spinnerElId}.spinning {
            transform: rotate(${spinningTime/3}turn);
        }`);

    const overlayEl = document.createElement('div');
    overlayEl.id = overlayElId;
    const spinnerEl = document.createElement('div');
    spinnerEl.id = spinnerElId;
    overlayEl.appendChild(spinnerEl);

    let isFirstTime = true;
    const start = () => {
        if (!document.body) {
            setTimeout(start, 100);
            return;
        }

        document.body.appendChild(overlayEl);
        if (!isFirstTime) {
            overlayEl.hidden = false;
            overlayEl.classList.toggle('fading', false);
        }

        setTimeout(() => {
            spinnerEl.classList.toggle('spinning', true);
        }, 100);

        isFirstTime = false;
    };

    const stop = () => {
        overlayEl.classList.toggle('fading', true);
        setTimeout(() => {
            overlayEl.hidden = true;
            spinnerEl.classList.toggle('spinning', false);
        }, stopFadeoutTime * 1000);
    };

    HygeoLoadingSpinnerEl.INSTANCE = {
        start: start,
        stop: stop
    };

    return HygeoLoadingSpinnerEl.INSTANCE;
}