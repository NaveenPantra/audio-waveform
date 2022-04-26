const CONSTANTS = {
  DOMSelectors: {
    WAVE_FORM_WRAPPER: '.wave_form_wrapper',
    WAVE_FORM_BCK: '.wave_form_back',
    WAVE_FORM_FRONT: '.wave_form_front',
    AUDIO_SCRUBBER: '.audio_scrubber',
    DOM_AUDIO_PLAYER: '.dom_audio_player',
    CURRENT_TIME: '.audio_current_time_text',
    DURATION_TIME: '.audio_total_duration',
    AUDIO_PLAYER_PLAY: '.audio_player_play'
  },
  DOM_STRINGS: {
    FREQUENCY_STICK_WRAPPER: 'frequency_stick_wrapper',
    FREQUENCY_STICK: 'frequency_stick',
    DOM_AUDIO_PLAYER: 'dom_audio_player',
    AUDIO_SCRUBBER: 'audio_scrubber',
    HIDE: 'hide',
  },
  SEEK_TRANSITION: 'all .3s linear',
  SEEK_TRANSITION_0: 'all 0s linear',
  URL: './audio.mp3'
}

const utils = (function () {
  function getDOMElements() {
    const { DOMSelectors } = CONSTANTS
    const DOMElements = {}
    for (let selector in DOMSelectors) {
      DOMElements[selector] = document.querySelector(DOMSelectors[selector])
    }
    return DOMElements
  }

  function getClipPointWaveFormFront(percentage) {
    return `polygon(0 0, ${percentage}% 0%, ${percentage}% 100%, 0 100%)`
  }

  function formatTimeInSSToMMSS(seconds = 0) {
    seconds = Math.ceil(seconds)
    let minutes = Math.floor(seconds / 60)
    seconds = seconds - (minutes * 60)
    minutes = minutes > 9 ? minutes : `0${minutes}`
    seconds = seconds > 9 ? seconds : `0${seconds}`
    return `${minutes}:${seconds}`
  }

  return { getDOMElements, getClipPointWaveFormFront, formatTimeInSSToMMSS }
})()

const model = (function() {
  let audioFrequencyData = new Array(300)
  let mouseDownOnScrubber = false
  let minStickHeight = 5
  audioFrequencyData = audioFrequencyData.fill(minStickHeight)
  let totalAudioDuration = 0
  let seekPoint = 0
  let seekPercentage = 0
  let isTemporarilyPaused = false
  let isBuffering = false

  return { audioFrequencyData, mouseDownOnScrubber, minStickHeight, totalAudioDuration, seekPercentage, seekPoint, isTemporarilyPaused, isBuffering }
})()

const view = (function (model) {
  let DOMElements = utils.getDOMElements()

  function initDOMAudioPlayer() {
    const audio = new Audio(CONSTANTS.URL)
    audio.controls = true;
    audio.classList.add(CONSTANTS.DOM_STRINGS.DOM_AUDIO_PLAYER)
    audio.classList.add(CONSTANTS.DOM_STRINGS.HIDE)
    DOMElements.WAVE_FORM_WRAPPER.appendChild(audio)
    DOMElements = utils.getDOMElements()
  }

  function updateTotalDurationDOM() {
    DOMElements.DURATION_TIME.textContent = utils.formatTimeInSSToMMSS(model.totalAudioDuration)
  }

  function updateCurrentAudioTimeDOM(seconds) {
    const isBuffering = model.isBuffering ?? false
    DOMElements.CURRENT_TIME.textContent = `${utils.formatTimeInSSToMMSS(seconds)}${isBuffering ? "(Buffering...)" : ""}`
  }

  function getFrequencySticks({ isFront = true }) {
    const frequencySticksWrapper = document.createElement('div')
    frequencySticksWrapper.classList.add(CONSTANTS.DOM_STRINGS.FREQUENCY_STICK_WRAPPER)
    model.audioFrequencyData.forEach(frequency => {
      const stick = document.createElement('div')
      stick.classList.add(CONSTANTS.DOM_STRINGS.FREQUENCY_STICK)
      stick.style.height = `${frequency ?? model.minStickHeight}%`
      stick.style.width = '1px'
      stick.style.background = `var(${ isFront ? '--color-primary' : '--color-primary-op'})`
      frequencySticksWrapper.appendChild(stick)
    })
    return frequencySticksWrapper
  }

  function drawFrequencySticks() {
    const DOMElements = utils.getDOMElements()
    DOMElements.WAVE_FORM_BCK.innerHTML = ''
    DOMElements.WAVE_FORM_FRONT.innerHTML = ''
    let frequencySticks = getFrequencySticks({ isFront: true})
    DOMElements.WAVE_FORM_FRONT.appendChild(frequencySticks)
    frequencySticks = getFrequencySticks({ isFront: false })
    DOMElements.WAVE_FORM_BCK.appendChild(frequencySticks)
  }

  function removeTransitionForWaveform() {}

  function seekWaveFormAndScrubber({ seekPoint, seekPercentage, withAnimation = true }) {
    const transition = withAnimation ? CONSTANTS.SEEK_TRANSITION : CONSTANTS.SEEK_TRANSITION_0
    DOMElements.WAVE_FORM_FRONT.style.transition = transition
    DOMElements.AUDIO_SCRUBBER.style.transition = transition
    DOMElements.WAVE_FORM_FRONT.style.clipPath = utils.getClipPointWaveFormFront(seekPercentage)
    DOMElements.AUDIO_SCRUBBER.style.left = `${seekPercentage}%`
  }

  function updateScrubberPosition() {
    if (DOMElements.DOM_AUDIO_PLAYER.paused) {
      return
    }
    const currentTIme = DOMElements.DOM_AUDIO_PLAYER.currentTime
    const totalDuration = model.totalAudioDuration
    const seekPercentage = (currentTIme / totalDuration) * 100
    updateCurrentAudioTimeDOM(currentTIme)
    seekWaveFormAndScrubber({ seekPercentage , withAnimation: false})
    requestAnimationFrame(updateScrubberPosition)
  }

  return { initDOMAudioPlayer, drawFrequencySticks, seekWaveFormAndScrubber, updateTotalDurationDOM, updateScrubberPosition, updateCurrentAudioTimeDOM }

})(model)

const AudioController = (function (model, view) {
  let DOMElements = utils.getDOMElements()
  function init() {
    view.initDOMAudioPlayer()
    view.drawFrequencySticks()
    DOMElements = utils.getDOMElements()
    DOMElements.DOM_AUDIO_PLAYER.addEventListener('loadedmetadata', handleMetaDataLoadedForAudio)
    DOMElements.DOM_AUDIO_PLAYER.addEventListener('waiting', handleAudioWaiting)
    DOMElements.DOM_AUDIO_PLAYER.addEventListener('playing', handleAudioResumed)
    DOMElements.WAVE_FORM_WRAPPER.addEventListener('click', handleSeek)
    DOMElements.WAVE_FORM_WRAPPER.addEventListener('mousemove', handleMouseMoveOnWaveForm)
    DOMElements.WAVE_FORM_WRAPPER.addEventListener('mouseup', handleMouseUpOnWaveForm)
    DOMElements.WAVE_FORM_WRAPPER.addEventListener('mouseleave', handleMouseLeaveFromWaveForm)
    DOMElements.AUDIO_SCRUBBER.addEventListener('mousedown', handleMouseDownOnScrubber)
    DOMElements.WAVE_FORM_FRONT.addEventListener('transitionend', handleSeekTransitionEnded)
    DOMElements.AUDIO_PLAYER_PLAY.addEventListener('click', toggleAudioPlay)
  }

  function getCurrentTimeFromSeekPercentage(seekPercentage) {
    const totalDuration = getAudioDuration()
    return (seekPercentage * totalDuration) / 100
  }

  function handleSeekTransitionEnded() {
    const seekPercentage = model.seekPercentage
    DOMElements.DOM_AUDIO_PLAYER.currentTime = getCurrentTimeFromSeekPercentage(seekPercentage)
    playAudio()

  }

  function handleMetaDataLoadedForAudio() {
    model.totalAudioDuration = getAudioDuration()
    view.updateTotalDurationDOM()
    view.updateCurrentAudioTimeDOM(0)
  }

  function handleAudioWaiting() {
    model.isBuffering = true
  }

  function handleAudioResumed() {
    model.isBuffering = false
  }

  function drawFrequencyData(audioFrequencyData) {
    model.audioFrequencyData = audioFrequencyData
    view.drawFrequencySticks()
  }

  function getSeekPointAndPercentage(event) {
    const { x: startingXCoordinateOfWaveForm, width: waveFormWidth } = DOMElements.WAVE_FORM_WRAPPER.getClientRects()[0]
    const xCoordinateOfMouseClick = event.clientX
    let seekPoint = xCoordinateOfMouseClick - startingXCoordinateOfWaveForm
    if (seekPoint >= waveFormWidth) seekPoint = waveFormWidth
    if ( seekPoint <= 0) seekPoint = 0
    const seekPercentage = (seekPoint / waveFormWidth) * 100
    const seekPosition = { seekPoint, seekPercentage }
    model.seekPercentage = seekPosition.seekPercentage
    model.seekPoint = seekPosition.seekPoint
    return seekPosition
  }

  function handleSeek(event) {
    // if (!event.target.closest(CONSTANTS.DOM_STRINGS.FREQUENCY_STICK_WRAPPER)) return
    if (event.target.classList.contains(CONSTANTS.DOM_STRINGS.AUDIO_SCRUBBER)) return
    model.mouseDownOnScrubber = false
    pauseAudio()
    const { seekPoint, seekPercentage } = getSeekPointAndPercentage(event)
    view.seekWaveFormAndScrubber({seekPoint, seekPercentage, withAnimation: true})
  }

  function handleMouseDownOnScrubber() {
    model.mouseDownOnScrubber = true
    pauseAudio()
  }

  function handleMouseMoveOnWaveForm(event) {
    if (!model.mouseDownOnScrubber) return
    const { seekPoint, seekPercentage } = getSeekPointAndPercentage(event)
    const currentTime = getCurrentTimeFromSeekPercentage(seekPercentage)
    DOMElements.DOM_AUDIO_PLAYER.currentTime = currentTime
    DOMElements.CURRENT_TIME.textContent = utils.formatTimeInSSToMMSS(currentTime)
    view.seekWaveFormAndScrubber({seekPoint, seekPercentage, withAnimation: false})
  }

  function handleMouseUpOnWaveForm() {
    if (model.mouseDownOnScrubber && DOMElements.DOM_AUDIO_PLAYER.paused) {
      playAudio()
    }
    model.mouseDownOnScrubber = false
  }

  function handleMouseLeaveFromWaveForm() {
    if (model.mouseDownOnScrubber && DOMElements.DOM_AUDIO_PLAYER.paused) {
      playAudio()
    }
    model.mouseDownOnScrubber = false
  }

  function toggleAudioPlay() {
    if (DOMElements.DOM_AUDIO_PLAYER.paused) {
      playAudio()
      return
    }
    pauseAudio()
  }

  function pauseAudio() {
    DOMElements.DOM_AUDIO_PLAYER.pause()
  }

  function playAudio() {
    // if (DOMElements.DOM_AUDIO_PLAYER.currentTime === DOMElements.DOM_AUDIO_PLAYER.duration) {
    //   model.seekPercentage = 0;
    //   view.seekWaveFormAndScrubber({ seekPercentage: 0 })
    //   return
    // }
    DOMElements.DOM_AUDIO_PLAYER.play()
    requestAnimationFrame(view.updateScrubberPosition)
  }

  function getAudioDuration() {
    return Math.ceil(DOMElements.DOM_AUDIO_PLAYER.duration)
  }

  return {
    init,
    DOMElements,
    drawFrequencyData
  }
})(model, view)

AudioController.init()
