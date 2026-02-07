import { Component, ElementRef, Input, ViewChild, OnInit, OnDestroy, Output, EventEmitter } from '@angular/core'
import { CommonModule, AsyncPipe } from '@angular/common'
import { FormsModule } from '@angular/forms'
import type { Observable } from 'rxjs'
import {
  IonButton,
  IonCol,
  IonContent,
  IonGrid,
  IonIcon,
  IonRange,
  IonRow,
} from '@ionic/angular/standalone'
import { NavController } from '@ionic/angular'
import { addIcons } from 'ionicons'
import {
  pause,
  play,
  pauseOutline,
  playOutline,
  playSkipBack,
  playSkipForward,
  volumeHighOutline,
  volumeLowOutline,
  expandOutline,
  contractOutline,
} from 'ionicons/icons'
import type { Media } from '../media'
import { SpotifyService } from '../spotify.service'
import { PlayerService } from '../player.service'
import { LogService } from '../log.service'
import { MediaService } from '../media.service'
import { ActivatedRoute, Router } from '@angular/router'
import { CurrentSpotify } from '../current.spotify'
import { CurrentMPlayer } from '../current.mplayer'

interface VideoPlayerEvents {
  volUp: void
  volDown: void
  playPause: void
  skipPrev: void
  skipNext: void
  fullscreenToggle: void
}

@Component({
  selector: 'app-video-player',
  templateUrl: './video-player.page.html',
  styleUrls: ['./video-player.page.scss'],
  imports: [
    CommonModule,
    FormsModule,
    AsyncPipe,
    IonContent,
    IonGrid,
    IonRow,
    IonCol,
    IonRange,
    IonButton,
    IonIcon,
  ],
})
export class VideoPlayerPage implements OnInit, OnDestroy {
  @ViewChild('videoPlayer', { static: false }) videoPlayer: ElementRef<HTMLVideoElement>
  @ViewChild('range', { static: false }) range: IonRange

  @Input() media: Media
  @Input() resumemedia: Media
  @Input() playing = true

  @Output() volUpEvent = new EventEmitter<void>()
  @Output() volDownEvent = new EventEmitter<void>()
  @Output() playPauseEvent = new EventEmitter<void>()
  @Output() skipPrevEvent = new EventEmitter<void>()
  @Output() skipNextEvent = new EventEmitter<void>()
  @Output() fullscreenToggleEvent = new EventEmitter<void>()
  @Output() videoEnded = new EventEmitter<void>()
  @Output() progressUpdate = new EventEmitter<{ currentTime: number; duration: number; progress: number }>()

  videoUrl = ''
  isFullscreen = false
  
  progress = 0
  currentVideoTime = 0
  videoDuration = 0
  showControls = false
  resumePlay = false
  private controlsTimeout: any
  private isExternalPlayback = false
  private fullscreenChangeHandler: () => void

  public readonly spotify$: Observable<CurrentSpotify>
  public readonly local$: Observable<CurrentMPlayer>

  constructor(
    private logService: LogService,
    private mediaService: MediaService,
    _route: ActivatedRoute,
    private router: Router,
    private navController: NavController,
    private playerService: PlayerService,
    private spotifyService: SpotifyService,) {
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
      pauseOutline,
      pause,
      play,
      playOutline,
      playSkipBack,
      playSkipForward,
      volumeHighOutline,
      volumeLowOutline,
      expandOutline,
      contractOutline,
    })

    this.fullscreenChangeHandler = () => {
      this.isFullscreen = !!document.fullscreenElement
    }
  }

  ngOnInit(): void {
    document.addEventListener('fullscreenchange', this.fullscreenChangeHandler)
    document.addEventListener('webkitfullscreenchange', this.fullscreenChangeHandler)
    document.addEventListener('mozfullscreenchange', this.fullscreenChangeHandler)
    document.addEventListener('msfullscreenchange', this.fullscreenChangeHandler)

    // Prüfen ob Media-Objekt Video-Content enthält
    if (this.media) {
        this.videoUrl = (this.media as any).videoUrl || 
                       (this.media as any).url || 
                       (this.media as any).streamUrl || 
                        this.media.id || ''
    }
  }

  ngOnDestroy(): void {
    document.removeEventListener('fullscreenchange', this.fullscreenChangeHandler)
    document.removeEventListener('webkitfullscreenchange', this.fullscreenChangeHandler)
    document.removeEventListener('mozfullscreenchange', this.fullscreenChangeHandler)
    document.removeEventListener('msfullscreenchange', this.fullscreenChangeHandler)

    if (this.controlsTimeout) {
      clearTimeout(this.controlsTimeout)
    }
  }

  toggleControls(): void {
    this.showControls = !this.showControls

    if (this.showControls) {
      if (this.controlsTimeout) {
        clearTimeout(this.controlsTimeout)
      }
      this.controlsTimeout = setTimeout(() => {
        this.showControls = false
      }, 5000)
    }
  }

  onVideoTimeUpdate(event: Event): void {
    if (this.videoPlayer?.nativeElement) {
      const video = this.videoPlayer.nativeElement
      this.currentVideoTime = video.currentTime
      this.videoDuration = video.duration

      if (this.videoDuration > 0) {
        this.progress = (this.currentVideoTime / this.videoDuration) * 100
      }

      this.progressUpdate.emit({
        currentTime: this.currentVideoTime,
        duration: this.videoDuration,
        progress: this.progress,
      })
    }
  }

  onVideoLoadedMetadata(event: Event): void {
    const video = event.target as HTMLVideoElement
    this.videoDuration = video.duration
  }

  onVideoPlay(): void {
    this.playing = true
  }

  onVideoPause(): void {
    this.playing = false
  }

  onVideoEnded_Event(): void {
    this.videoEnded.emit()
  }

  onVolumeChange(event: Event): void {
    // Volume changes are handled
  }

  formatTime(seconds: number): string {
    if (!seconds || isNaN(seconds)) {
      return '0:00'
    }
    const minutes = Math.floor(seconds / 60)
    const secs = Math.floor(seconds % 60)
    return `${minutes}:${secs.toString().padStart(2, '0')}`
  }

  seek(): void {
    if (this.videoPlayer?.nativeElement) {
      const video = this.videoPlayer.nativeElement
      if (video.duration > 0) {
        const newValue = +this.range.value
        video.currentTime = (video.duration * newValue) / 100
      }
    }
  }

  volUp(): void {
    if (this.videoPlayer?.nativeElement) {
      const video = this.videoPlayer.nativeElement
      video.volume = Math.min(1, video.volume + 0.1)
    }
    this.volUpEvent.emit()
  }

  volDown(): void {
    if (this.videoPlayer?.nativeElement) {
      const video = this.videoPlayer.nativeElement
      video.volume = Math.max(0, video.volume - 0.1)
    }
    this.volDownEvent.emit()
  }

  playPause(): void {
    if (this.videoPlayer?.nativeElement) {
      const video = this.videoPlayer.nativeElement
      if (this.playing) {
        video.pause()
      } else {
        video.play()
      }
    }
    this.playPauseEvent.emit()
  }

  skipPrev(): void {
    this.skipPrevEvent.emit()
  }

  skipNext(): void {
    this.skipNextEvent.emit()
  }

  toggleFullscreen(): void {
    if (this.videoPlayer?.nativeElement) {
      const video = this.videoPlayer.nativeElement

      if (!document.fullscreenElement) {
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
    this.fullscreenToggleEvent.emit()
  }
}
