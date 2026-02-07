import { AsyncPipe } from '@angular/common'
import { Component, OnInit, ViewChild, ElementRef } from '@angular/core'
import { FormsModule } from '@angular/forms'
import { ActivatedRoute, Router } from '@angular/router'
import {
  IonBackButton,
  IonButton,
  IonButtons,
  IonCard,
  IonCol,
  IonContent,
  IonGrid,
  IonHeader,
  IonIcon,
  IonRange,
  IonRow,
  IonTitle,
  IonToolbar,
  NavController,
} from '@ionic/angular/standalone'
import { addIcons } from 'ionicons'
import {
  arrowBackOutline,
  pause,
  play,
  playBack,
  playForward,
  playSkipBack,
  playSkipForward,
  shuffleOutline,
  volumeHighOutline,
  volumeLowOutline,
  expandOutline,
  contractOutline,
} from 'ionicons/icons'
import type { Observable } from 'rxjs'
import type { AlbumStop } from '../albumstop'
import type { CurrentMPlayer } from '../current.mplayer'
import type { CurrentSpotify } from '../current.spotify'
import { LogService } from '../log.service'
import type { Media } from '../media'
import { MediaService } from '../media.service'
import { MupiHatIconComponent } from '../mupihat-icon/mupihat-icon.component'
import { PlayerCmds, PlayerService } from '../player.service'
import { SpotifyService } from '../spotify.service'

@Component({
  selector: 'app-player',
  templateUrl: './player.page.html',
  styleUrls: ['./player.page.scss'],
  imports: [
    FormsModule,
    AsyncPipe,
    MupiHatIconComponent,
    IonHeader,
    IonToolbar,
    IonButtons,
    IonBackButton,
    IonTitle,
    IonContent,
    IonGrid,
    IonRow,
    IonCol,
    IonCard,
    IonRange,
    IonButton,
    IonIcon,
  ],
})
export class PlayerPage implements OnInit {
  @ViewChild('range', { static: false }) range: IonRange
  @ViewChild('videoPlayer', { static: false }) videoPlayer: ElementRef<HTMLVideoElement>

  media: Media
  resumemedia: Media
  albumStop: AlbumStop
  resumePlay = false
  resumeIndex: number
  resumeTimer = 0
  resumeAdded = false
  cover = ''
  playing = true
  updateProgression = false
  private isExternalPlayback = false
  currentPlayedSpotify: CurrentSpotify
  currentPlayedLocal: CurrentMPlayer
  showTrackNr = 0
  goBackTimer = 0
  progress = 0
  shufflechanged = 0
  tmpProgressTime = 0
  public readonly spotify$: Observable<CurrentSpotify>
  public readonly local$: Observable<CurrentMPlayer>

  // Video-spezifische Properties
  isVideoMode = false
  videoUrl = ''
  isFullscreen = false
  currentVideoTime = 0
  videoDuration = 0
  showVideoControls = false
  private videoControlsTimeout: any
  private fullscreenChangeHandler: () => void

  constructor(
    private logService: LogService,
    private mediaService: MediaService,
    _route: ActivatedRoute,
    private router: Router,
    private navController: NavController,
    private playerService: PlayerService,
    private spotifyService: SpotifyService,
  ) {
    this.spotify$ = this.mediaService.current$
    this.local$ = this.mediaService.local$

    if (this.router.currentNavigation()?.extras.state?.media) {
      this.media = this.router.currentNavigation().extras.state.media
      if (this.media.category === 'resume') {
        this.resumePlay = true
      }
      this.isExternalPlayback = false
    } else {
      this.isExternalPlayback = true
    }
    addIcons({
      arrowBackOutline,
      volumeLowOutline,
      pause,
      play,
      volumeHighOutline,
      playSkipBack,
      playSkipForward,
      playBack,
      shuffleOutline,
      playForward,
      expandOutline,
      contractOutline,
    })

    // Fullscreen Event Listener
    this.fullscreenChangeHandler = () => {
      this.isFullscreen = !!document.fullscreenElement
    }
  }

  ngOnInit() {
    // Handle case where no media object was provided (external playback)
    if (!this.media) {
      this.handleExternalPlayback()
    }

    // Video-Modus erkennen
    this.detectVideoMode()

    this.mediaService.current$.subscribe((spotify) => {
      this.currentPlayedSpotify = spotify
    })
    this.mediaService.local$.subscribe((local) => {
      this.currentPlayedLocal = local
    })
    // Use cover from CurrentSpotify for Spotify content, fallback to media.cover for other types
    this.mediaService.current$.subscribe((spotify) => {
      if (this.media?.type === 'spotify' && spotify?.item?.album?.images?.[0]?.url) {
        this.cover = spotify.item.album.images[0].url
      } else if (this.media?.cover) {
        this.cover = this.media.cover
      } else {
        this.cover = '../assets/images/nocover_mupi.png'
      }
    })
    this.mediaService.albumStop$.subscribe((albumStop) => {
      this.albumStop = albumStop
    })

    // Fullscreen Event Listener registrieren
    document.addEventListener('fullscreenchange', this.fullscreenChangeHandler)
    document.addEventListener('webkitfullscreenchange', this.fullscreenChangeHandler)
    document.addEventListener('mozfullscreenchange', this.fullscreenChangeHandler)
    document.addEventListener('msfullscreenchange', this.fullscreenChangeHandler)
  }

  ngOnDestroy() {
    // Cleanup Fullscreen Event Listeners
    document.removeEventListener('fullscreenchange', this.fullscreenChangeHandler)
    document.removeEventListener('webkitfullscreenchange', this.fullscreenChangeHandler)
    document.removeEventListener('mozfullscreenchange', this.fullscreenChangeHandler)
    document.removeEventListener('msfullscreenchange', this.fullscreenChangeHandler)
  }

  private detectVideoMode(): void {
    // Prüfen ob Media-Objekt Video-Content enthält
    if (this.media) {
      // Verschiedene Möglichkeiten wie Video-Content markiert sein könnte
      this.isVideoMode = 
        this.media.type === 'video' || 
        this.media.category === 'video' ||
        (this.media as any).isVideo === true ||
        (this.media as any).videoUrl !== undefined

      if (this.isVideoMode) {
        // Video-URL aus verschiedenen möglichen Quellen extrahieren
        this.videoUrl = (this.media as any).videoUrl || 
                       (this.media as any).url || 
                       (this.media as any).streamUrl || 
                        this.media.id ||
                       ''
        
        this.logService.log('[PlayerPage] Video mode detected, URL:', this.videoUrl)
      }
    }
  }

  private handleExternalPlayback(): void {
    // Check if there's currently playing Spotify content we can use
    const currentTrack = this.spotifyService.currentTrack$.value
    if (currentTrack) {
      this.logService.log('[PlayerPage] Creating media object for externally started Spotify playback')
      this.media = this.spotifyService.createMediaFromSpotifyTrack(currentTrack)
      this.logService.log('[PlayerPage] External playback media object created:', this.media)
    } else {
      // Fallback: create a minimal media object and wait for track info
      this.logService.log('[PlayerPage] No current track info available, creating fallback media object')
      this.media = {
        type: 'spotify',
        category: 'music',
        title: 'External Playback',
        artist: 'Unknown',
        cover: '../assets/images/nocover_mupi.png',
      }

      // Subscribe to currentTrack$ to update when track info becomes available
      this.spotifyService.currentTrack$.subscribe((track) => {
        if (track && this.media.title === 'External Playback') {
          this.logService.log('[PlayerPage] Updating media object with track info:', track.name)
          this.media = this.spotifyService.createMediaFromSpotifyTrack(track)
        }
      })
    }
  }

  // Video-spezifische Event-Handler
  onVideoTimeUpdate(event: Event): void {
    if (this.videoPlayer?.nativeElement) {
      const video = this.videoPlayer.nativeElement
      this.currentVideoTime = video.currentTime
      this.videoDuration = video.duration
      
      if (this.videoDuration > 0) {
        this.progress = (this.currentVideoTime / this.videoDuration) * 100
      }
    }
  }

  onVideoEnded(): void {
    this.logService.log('[PlayerPage] Video ended')
    // Optional: Automatisch zum nächsten Video springen
    this.skipNext()
  }

  onVideoLoadedMetadata(event: Event): void {
    const video = event.target as HTMLVideoElement
    this.videoDuration = video.duration
    this.logService.log('[PlayerPage] Video metadata loaded, duration:', this.videoDuration)
  }

  onVideoPlay(): void {
    this.playing = true
    this.logService.log('[PlayerPage] Video play event')
  }

  onVideoPause(): void {
    this.playing = false
    this.logService.log('[PlayerPage] Video pause event')
  }

  onVolumeChange(event: Event): void {
    if (this.videoPlayer?.nativeElement) {
      const video = this.videoPlayer.nativeElement
      this.logService.log('[PlayerPage] Video volume changed to:', video.volume)
    }
  }

  toggleFullscreen(): void {
    if (this.videoPlayer?.nativeElement) {
      const video = this.videoPlayer.nativeElement
      
      if (!document.fullscreenElement) {
        // Enter fullscreen
        if (video.requestFullscreen) {
          video.requestFullscreen()
        } else if ((video as any).webkitRequestFullscreen) {
          (video as any).webkitRequestFullscreen()
        } else if ((video as any).mozRequestFullScreen) {
          (video as any).mozRequestFullScreen()
        } else if ((video as any).msRequestFullscreen) {
          (video as any).msRequestFullscreen()
        }
      } else {
        // Exit fullscreen
        if (document.exitFullscreen) {
          document.exitFullscreen()
        } else if ((document as any).webkitExitFullscreen) {
          (document as any).webkitExitFullscreen()
        } else if ((document as any).mozCancelFullScreen) {
          (document as any).mozCancelFullScreen()
        } else if ((document as any).msExitFullscreen) {
          (document as any).msExitFullscreen()
        }
      }
    }
  }

  formatTime(seconds: number): string {
    if (!seconds || isNaN(seconds)) {
      return '0:00'
    }
    const minutes = Math.floor(seconds / 60)
    const secs = Math.floor(seconds % 60)
    return `${minutes}:${secs.toString().padStart(2, '0')}`
  }

  toggleVideoControls(): void {
    if (this.isVideoMode) {
      this.showVideoControls = !this.showVideoControls
      this.logService.log('[PlayerPage] Video controls toggled:', this.showVideoControls)
      
      // Auto-hide nach 5 Sekunden
      if (this.showVideoControls) {
        if (this.videoControlsTimeout) {
          clearTimeout(this.videoControlsTimeout)
        }
        this.videoControlsTimeout = setTimeout(() => {
          this.showVideoControls = false
        }, 5000)
      }
    }
  }

  seek() {
    const newValue = +this.range.value
    
    if (this.isVideoMode && this.videoPlayer?.nativeElement) {
      // Video-Seek über HTML5 Video API
      const video = this.videoPlayer.nativeElement
      if (video.duration > 0) {
        video.currentTime = (video.duration * newValue) / 100
        this.logService.log('[PlayerPage] Video seek to:', video.currentTime)
      }
    } else {
      // Bestehende Audio-Seek-Logik
      if (this.media.type === 'spotify') {
        const duration = this.currentPlayedSpotify?.item.duration_ms
        this.playerService.seekPosition(duration * (newValue / 100))
      } else if (this.media.type === 'library' || this.media.type === 'rss') {
        this.playerService.seekPosition(newValue)
      }
    }
  }

  updateProgress() {
    this.mediaService.current$.subscribe((spotify) => {
      this.currentPlayedSpotify = spotify
    })
    this.mediaService.local$.subscribe((local) => {
      this.currentPlayedLocal = local
    })

    // Für Video wird der Progress über onVideoTimeUpdate aktualisiert
    if (this.isVideoMode) {
      this.playing = this.videoPlayer?.nativeElement ? !this.videoPlayer.nativeElement.paused : false
      
      setTimeout(() => {
        if (this.updateProgression) {
          this.updateProgress()
        }
      }, 1000)
      return
    }

    // Bestehende Audio-Progress-Logik
    this.playing = !this.currentPlayedLocal?.pause
    if (this.playing) {
      this.resumeTimer++
      if (this.resumeTimer % 30 === 0) {
        this.saveResumeFiles()
      }
    }

    if (this.media.type === 'spotify') {
      const seek = this.currentPlayedSpotify?.progress_ms || 0
      if (this.currentPlayedSpotify?.item != null) {
        this.progress = (seek / this.currentPlayedSpotify?.item.duration_ms) * 100 || 0
      }
      if (this.playing && !this.currentPlayedSpotify?.is_playing) {
        this.goBackTimer++
        if (this.goBackTimer > 10) {
          this.navController.back()
        }
      }
      setTimeout(() => {
        if (this.updateProgression) {
          this.updateProgress()
        }
      }, 1000)
    } else if (this.media.type === 'library' || this.media.type === 'rss') {
      const seek = this.currentPlayedLocal?.progressTime || 0
      this.progress = seek || 0
      if (
        this.media.type === 'library' &&
        this.playing &&
        !this.currentPlayedLocal?.playing &&
        this.currentPlayedLocal?.currentTracknr === this.currentPlayedLocal?.totalTracks
      ) {
        this.goBackTimer++
        if (this.goBackTimer > 10) {
          this.navController.back()
        }
      }
      if (this.media.type === 'rss' && this.playing && !this.currentPlayedLocal?.playing) {
        this.goBackTimer++
        if (this.goBackTimer > 100) {
          this.navController.back()
        }
      }
      setTimeout(() => {
        if (this.updateProgression) {
          this.updateProgress()
        }
      }, 1000)
    }
  }

  async ionViewWillEnter() {
    this.updateProgression = true
    
    if (this.isVideoMode) {
      // Für Video-Modus: Nur URL setzen, autoplay übernimmt den Rest
      this.logService.log('[PlayerPage] Entering video mode')
      this.updateProgress()
    } else if (this.resumePlay) {
      await this.resumePlayback()
      this.updateProgress()
    } else if (!this.isExternalPlayback) {
      // Only start playback if this is not external playback (already playing)
      const success = await this.playerService.playMedia(this.media)
      if (!success && this.media.type === 'spotify') {
        this.logService.error('[PlayerPage] Failed to start Spotify playback - player health check failed')
        // Mark as not playing and navigate back
        this.playing = false
        this.updateProgression = false
        this.navController.back()
        return
      }
      this.updateProgress()
    } else {
      this.updateProgress()
    }

    if (this.media?.shuffle && !this.isExternalPlayback && !this.isVideoMode) {
      setTimeout(() => {
        this.playerService.sendCmd(PlayerCmds.SHUFFLEON)
        setTimeout(() => {
          this.skipNext()
        }, 1000)
      }, 5000)
    }
  }

  ionViewWillLeave() {
    if (this.isVideoMode) {
      // Video stoppen
      if (this.videoPlayer?.nativeElement) {
        this.videoPlayer.nativeElement.pause()
      }
      // Fullscreen beenden falls aktiv
      if (this.isFullscreen) {
        this.toggleFullscreen()
      }
    } else {
      // Bestehende Audio-Logik
      if (
        (this.media.type === 'spotify' || this.media.type === 'library' || this.media.type === 'rss') &&
        !this.media.shuffle &&
        this.resumeTimer > 30 &&
        this.playing
      ) {
        this.saveResumeFiles()
      }
      this.playerService.sendCmd(PlayerCmds.STOP)
      if (this.media.shuffle || this.shufflechanged) {
        this.playerService.sendCmd(PlayerCmds.SHUFFLEOFF)
      }
      if (this.albumStop?.albumStop === 'On') {
        this.playerService.sendCmd(PlayerCmds.ALBUMSTOP)
      }
    }
    
    this.updateProgression = false
    this.resumePlay = false
    
    if (this.media.type === 'spotify' && (this.media.category === 'music' || this.media.category === 'other')) {
      if (this.shufflechanged % 2 === 1) {
        this.mediaService.editRawMediaAtIndex(this.media.index, this.media)
      }
    }
  }

  async resumePlayback() {
    if (this.media.type === 'spotify' && !this.media.shuffle) {
      const success = await this.playerService.resumeMedia(this.media)
      if (!success) {
        this.logService.error('[PlayerPage] Failed to resume Spotify playback - player health check failed')
        // Mark as not playing and navigate back
        this.playing = false
        this.updateProgression = false
        this.navController.back()
        return
      }
    } else if (this.media.type === 'library') {
      this.media.category = this.media.resumelocalalbum
      const success = await this.playerService.playMedia(this.media)
      if (!success) {
        this.logService.error('[PlayerPage] Failed to start local library playback')
        return
      }
      let j = 1
      for (let i = 1; i < this.media.resumelocalcurrentTracknr; i++) {
        setTimeout(() => {
          this.skipNext()
          j = i + 1
          if (j === this.media.resumelocalcurrentTracknr) {
            setTimeout(() => {
              this.playerService.seekPosition(this.media.resumelocalprogressTime)
            }, 2000)
          }
        }, 2000)
      }
      if (this.media.resumelocalcurrentTracknr === 1) {
        setTimeout(() => {
          this.playerService.seekPosition(this.media.resumelocalprogressTime)
        }, 2000)
      }
    } else if (this.media.type === 'rss') {
      const success = await this.playerService.playMedia(this.media)
      if (!success) {
        this.logService.error('[PlayerPage] Failed to start RSS playback')
        return
      }
      setTimeout(() => {
        this.playerService.seekPosition(this.media.resumerssprogressTime)
      }, 2000)
    }
  }

  saveResumeFiles() {
    this.resumemedia = Object.assign({}, this.media)
    this.mediaService.current$.subscribe((spotify) => {
      this.currentPlayedSpotify = spotify
    })
    this.mediaService.local$.subscribe((local) => {
      this.currentPlayedLocal = local
    })
    if (this.resumemedia.type === 'spotify' && this.resumemedia?.showid) {
      this.resumemedia.resumespotifytrack_number = this.currentPlayedSpotify?.item?.track_number || 1
      this.resumemedia.resumespotifyprogress_ms = this.currentPlayedSpotify?.progress_ms || 0
      this.resumemedia.resumespotifyduration_ms = this.currentPlayedSpotify?.item?.duration_ms || 0
    } else if (this.resumemedia.type === 'spotify') {
      this.resumemedia.resumespotifytrack_number = this.currentPlayedSpotify?.item.track_number || 0
      this.resumemedia.resumespotifyprogress_ms = this.currentPlayedSpotify?.progress_ms || 0
      this.resumemedia.resumespotifyduration_ms = this.currentPlayedSpotify?.item.duration_ms || 0
    } else if (this.resumemedia.type === 'library') {
      this.resumemedia.resumelocalalbum = this.resumemedia.category
      this.resumemedia.resumelocalcurrentTracknr = this.currentPlayedLocal?.currentTracknr || 0
      this.resumemedia.resumelocalprogressTime = this.currentPlayedLocal?.progressTime || 0
    } else if (this.resumemedia.type === 'rss') {
      this.resumemedia.resumerssprogressTime = this.currentPlayedLocal?.progressTime || 0
    }
    this.resumemedia.category = 'resume'
    if (this.resumemedia.index !== undefined) {
      this.resumeIndex = this.resumemedia.index
      this.resumemedia.index = undefined
    }
    if (this.resumePlay || this.resumeAdded) {
      this.mediaService.editRawResumeAtIndex(this.resumeIndex, this.resumemedia)
    } else {
      this.mediaService.addRawResume(this.resumemedia)
      this.resumeAdded = true
      this.resumeIndex = 99
      setTimeout(() => {
        this.playerService.sendCmd(PlayerCmds.MAXRESUME)
      }, 2000)
    }
  }

  volUp() {
    if (this.isVideoMode && this.videoPlayer?.nativeElement) {
      const video = this.videoPlayer.nativeElement
      video.volume = Math.min(1, video.volume + 0.1)
      this.logService.log('[PlayerPage] Video volume up to:', video.volume)
    } else {
      this.playerService.sendCmd(PlayerCmds.VOLUMEUP)
    }
  }

  volDown() {
    if (this.isVideoMode && this.videoPlayer?.nativeElement) {
      const video = this.videoPlayer.nativeElement
      video.volume = Math.max(0, video.volume - 0.1)
      this.logService.log('[PlayerPage] Video volume down to:', video.volume)
    } else {
      this.playerService.sendCmd(PlayerCmds.VOLUMEDOWN)
    }
  }

  skipPrev() {
    if (this.isVideoMode) {
      // Video-spezifische Previous-Logik
      // Hier könnte eine Playlist-Logik implementiert werden
      this.logService.log('[PlayerPage] Video skip previous - not implemented')
    } else {
      if (this.playing) {
        this.playerService.sendCmd(PlayerCmds.PREVIOUS)
      } else {
        this.playing = true
        this.playerService.sendCmd(PlayerCmds.PREVIOUS)
      }
    }
  }

  skipNext() {
    if (this.isVideoMode) {
      // Video-spezifische Next-Logik
      // Hier könnte eine Playlist-Logik implementiert werden
      this.logService.log('[PlayerPage] Video skip next - not implemented')
    } else {
      if (this.playing) {
        this.playerService.sendCmd(PlayerCmds.NEXT)
      } else {
        this.playing = true
        this.playerService.sendCmd(PlayerCmds.NEXT)
      }
    }
  }

  toggleshuffle() {
    if (this.media.shuffle) {
      this.shufflechanged++
      this.media.shuffle = false
      this.playerService.sendCmd(PlayerCmds.SHUFFLEOFF)
    } else {
      this.shufflechanged++
      this.media.shuffle = true
      this.playerService.sendCmd(PlayerCmds.SHUFFLEON)
    }
  }

  playPause() {
    if (this.isVideoMode && this.videoPlayer?.nativeElement) {
      // Video-Steuerung über HTML5 Video API
      const video = this.videoPlayer.nativeElement
      if (this.playing) {
        video.pause()
        this.logService.log('[PlayerPage] Video paused')
      } else {
        video.play()
        this.logService.log('[PlayerPage] Video playing')
      }
    } else {
      // Bestehende Audio-Steuerung
      if (this.playing) {
        this.playerService.sendCmd(PlayerCmds.PAUSE)
        if (this.media.type === 'spotify' || this.media.type === 'library' || this.media.type === 'rss') {
          this.saveResumeFiles()
        }
      } else {
        this.playerService.sendCmd(PlayerCmds.PLAY)
      }
    }
  }

  seekForward() {
    if (this.isVideoMode && this.videoPlayer?.nativeElement) {
      const video = this.videoPlayer.nativeElement
      video.currentTime = Math.min(video.duration, video.currentTime + 10)
      this.logService.log('[PlayerPage] Video seek forward to:', video.currentTime)
    } else {
      this.playerService.sendCmd(PlayerCmds.SEEKFORWARD)
    }
  }

  seekBack() {
    if (this.isVideoMode && this.videoPlayer?.nativeElement) {
      const video = this.videoPlayer.nativeElement
      video.currentTime = Math.max(0, video.currentTime - 10)
      this.logService.log('[PlayerPage] Video seek back to:', video.currentTime)
    } else {
      this.playerService.sendCmd(PlayerCmds.SEEKBACK)
    }
  }
}
