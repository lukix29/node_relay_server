window.onload = () => {
    if (flvjs.isSupported()) {
        let videoElement = document.getElementById('videoElement');
        let features = flvjs.getFeatureList();
        console.log("FLV Features", features);
        let flvPlayer = flvjs.createPlayer({
            type: 'flv',
            isLive: true,
            //url: 'http://localhost/flv/app/lukix29.flv',
            url: 'ws://localhost/flvoutgest/app/lukix29.flv'
        }, {
            // enableStashBuffer: true,
            // enableWorker: false,
            // lazyLoad: true,
            // lazyLoadMaxDuration: 10,
            // lazyLoadRecoverDuration: 5,
            // autoCleanupSourceBuffer: true,
            // autoCleanupMaxBackwardDuration: 10,
            // autoCleanupMinBackwardDuration: 5,
        });
        flvPlayer.attachMediaElement(videoElement);
        flvPlayer.load();

        flvPlayer.on(flvjs.Events.METADATA_ARRIVED, function onMetadataArrived() {
            flvPlayer.play();
            flvPlayer.off(flvjs.Events.METADATA_ARRIVED, onMetadataArrived);
            document.addEventListener("mousedown", function () {
                videoElement.muted = false;
            });
        });
    }
};
