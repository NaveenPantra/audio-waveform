const url = './audio.mp3'

let wavesurfer = WaveSurfer.create({
  container: '.wave_surfer',
  waveColor: 'violet',
  progressColor: 'purple'
});

wavesurfer.load(url);

wavesurfer.on('ready', function() {
  wavesurfer.exportPCM(150, 100000, true).then(PCM => {
    PCM = PCM.map((f, i) => {
      return Number(Math.abs(f).toString().split('.')[1])
    }).filter(f => f !== false)
    let min = PCM[0]
    let max = PCM[0]
    for (let i = 1; i < PCM.length; i++) {
      if (PCM[i] > max) {
        max = PCM[i]
      }
      if (PCM[i] < min) {
        min = PCM[i]
      }
    }
    // console.log({ min, max, PCM})
    PCM = PCM.map(f => {
      return (90 - 5) * ((f - min) / (max - min)) + 5
    })
    AudioController.drawFrequencyData(PCM)
    // wavesurfer.play()
    // console.log(wavesurfer.getDuration())
  })
})
