import { useEffect, useRef, useState } from 'react'
import { parseLottoQr, type QrTicket } from '../lib/qr'

interface Props {
  onResult: (t: QrTicket) => void
  onClose: () => void
}

interface Detector {
  detect: (src: CanvasImageSource) => Promise<{ rawValue: string }[]>
}

/** 브라우저 내장 BarcodeDetector 가 있으면 쓰고, 없으면 jsQR 을 그때 불러온다 */
async function makeDecoder(): Promise<(c: HTMLCanvasElement) => Promise<string | null>> {
  const BD = (window as unknown as { BarcodeDetector?: new (o: object) => Detector }).BarcodeDetector
  if (BD) {
    try {
      const det = new BD({ formats: ['qr_code'] })
      return async (c) => (await det.detect(c))[0]?.rawValue ?? null
    } catch {
      /* jsQR 로 */
    }
  }
  const jsQR = (await import('jsqr')).default
  return async (c) => {
    const ctx = c.getContext('2d', { willReadFrequently: true })!
    const img = ctx.getImageData(0, 0, c.width, c.height)
    return jsQR(img.data, img.width, img.height, { inversionAttempts: 'dontInvert' })?.data ?? null
  }
}

function drawToCanvas(src: HTMLVideoElement | HTMLImageElement, canvas: HTMLCanvasElement, maxSide = 1000) {
  const w = src instanceof HTMLVideoElement ? src.videoWidth : src.naturalWidth
  const h = src instanceof HTMLVideoElement ? src.videoHeight : src.naturalHeight
  const scale = Math.min(1, maxSide / Math.max(w, h))
  canvas.width = Math.round(w * scale)
  canvas.height = Math.round(h * scale)
  canvas.getContext('2d', { willReadFrequently: true })!.drawImage(src, 0, 0, canvas.width, canvas.height)
}

export default function QrScanner({ onResult, onClose }: Props) {
  const videoRef = useRef<HTMLVideoElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const [status, setStatus] = useState<string>('카메라를 켜는 중…')
  const [error, setError] = useState<string | null>(null)
  const [paste, setPaste] = useState('')

  const handleText = (text: string): boolean => {
    const r = parseLottoQr(text)
    if (typeof r === 'string') {
      setError(r)
      return false
    }
    onResult(r)
    return true
  }

  useEffect(() => {
    let stream: MediaStream | null = null
    let stopped = false
    let raf = 0

    ;(async () => {
      if (!window.isSecureContext || !navigator.mediaDevices?.getUserMedia) {
        setStatus('이 주소에서는 카메라를 쓸 수 없어요 (https 필요). 아래 사진 선택을 이용하세요.')
        return
      }
      try {
        stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: { ideal: 'environment' }, width: { ideal: 1920 }, height: { ideal: 1080 } },
          audio: false,
        })
      } catch {
        setStatus('카메라 권한이 없어요. 아래 사진 선택을 이용하세요.')
        return
      }
      if (stopped) return stream.getTracks().forEach((t) => t.stop())
      const video = videoRef.current!
      video.srcObject = stream
      await video.play().catch(() => {})
      setStatus('용지의 QR 코드를 네모 안에 맞춰 주세요.')

      const decode = await makeDecoder()
      let busy = false
      const tick = async () => {
        if (stopped) return
        if (!busy && video.readyState >= 2 && video.videoWidth > 0) {
          busy = true
          try {
            drawToCanvas(video, canvasRef.current!)
            const text = await decode(canvasRef.current!)
            if (text && handleText(text)) return
          } catch {
            /* 다음 프레임 */
          }
          busy = false
        }
        raf = requestAnimationFrame(tick)
      }
      tick()
    })()

    return () => {
      stopped = true
      cancelAnimationFrame(raf)
      stream?.getTracks().forEach((t) => t.stop())
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const onFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    setError(null)
    const img = new Image()
    img.src = URL.createObjectURL(file)
    try {
      await img.decode()
      const decode = await makeDecoder()
      // 큰 사진은 줄여서, 실패하면 원본에 가깝게 다시
      for (const side of [1200, 2400]) {
        drawToCanvas(img, canvasRef.current!, side)
        const text = await decode(canvasRef.current!)
        if (text) {
          handleText(text)
          return
        }
      }
      setError('사진에서 QR을 찾지 못했어요. QR이 크게 나오게 다시 찍어 주세요.')
    } finally {
      URL.revokeObjectURL(img.src)
      e.target.value = ''
    }
  }

  return (
    <div className="modal" role="dialog" aria-modal="true" aria-label="QR 스캔">
      <div className="modal__body">
        <div className="card__head">
          <h2>로또 용지 QR 스캔</h2>
          <button className="link" onClick={onClose}>
            닫기
          </button>
        </div>
        <div className="scanner">
          <video ref={videoRef} playsInline muted />
          <div className="scanner__box" aria-hidden />
        </div>
        <canvas ref={canvasRef} hidden />
        <p className="hint">{status}</p>
        {error && <p className="error">{error}</p>}
        <div className="scanner__alt">
          <label className="btn-secondary">
            사진으로 읽기
            <input type="file" accept="image/*" capture="environment" onChange={onFile} hidden />
          </label>
          <form
            className="paste"
            onSubmit={(e) => {
              e.preventDefault()
              setError(null)
              handleText(paste)
            }}
          >
            <input
              className="input"
              value={paste}
              onChange={(e) => setPaste(e.target.value)}
              placeholder="또는 QR 주소 붙여넣기 (http://qr.dhlottery.co.kr/?v=…)"
              aria-label="QR 주소 붙여넣기"
            />
            <button className="primary primary--sm" type="submit">
              등록
            </button>
          </form>
        </div>
      </div>
    </div>
  )
}
