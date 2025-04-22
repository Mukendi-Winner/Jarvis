// Script pour le micro

    const circle = document.querySelector('.circle');
  
    navigator.mediaDevices.getUserMedia({ audio: true, video: false })
      .then(stream => {
        const audioContext = new AudioContext();
        const mic = audioContext.createMediaStreamSource(stream);
        const analyser = audioContext.createAnalyser();
        analyser.fftSize = 256;
  
        const dataArray = new Uint8Array(analyser.frequencyBinCount);
        mic.connect(analyser);
  
        function checkVolume() {
          analyser.getByteFrequencyData(dataArray);
          let volume = dataArray.reduce((a, b) => a + b) / dataArray.length;
  
          if (volume > 29) {
            circle.classList.add('active');
          } else {
            circle.classList.remove('active');
          }
  
          requestAnimationFrame(checkVolume);
        }
  
        checkVolume();
      })
      .catch(err => {
        console.error('Erreur micro :', err);
        alert('Micro inaccessible 😕 (autorise l\'accès s\'il te plaît)');
      });