import AppKit
import Foundation

let publicDir = URL(fileURLWithPath: CommandLine.arguments[1])

func color(_ hex: Int, alpha: CGFloat = 1) -> NSColor {
  NSColor(
    srgbRed: CGFloat((hex >> 16) & 0xFF) / 255,
    green: CGFloat((hex >> 8) & 0xFF) / 255,
    blue: CGFloat(hex & 0xFF) / 255,
    alpha: alpha
  )
}

let void = color(0x07080D)
let housing = color(0x1A1C24)
let housingStroke = color(0x2E3140)
let red = color(0xFF2D4A)
let yellow = color(0xFFC01A)
let green = color(0x22E38A)
let cream = color(0xF4EFE4)
let mute = color(0x9AA0B2)
let dimLamp = color(0x1B1D27)

func render(width: Int, height: Int, draw: () -> Void) -> Data {
  let rep = NSBitmapImageRep(
    bitmapDataPlanes: nil,
    pixelsWide: width,
    pixelsHigh: height,
    bitsPerSample: 8,
    samplesPerPixel: 4,
    hasAlpha: true,
    isPlanar: false,
    colorSpaceName: .deviceRGB,
    bytesPerRow: 0,
    bitsPerPixel: 0
  )!
  NSGraphicsContext.saveGraphicsState()
  NSGraphicsContext.current = NSGraphicsContext(bitmapImageRep: rep)!
  draw()
  NSGraphicsContext.restoreGraphicsState()
  return rep.representation(using: .png, properties: [:])!
}

func fill(_ rect: NSRect, _ fillColor: NSColor) {
  fillColor.setFill()
  NSBezierPath(rect: rect).fill()
}

func rounded(_ rect: NSRect, radius: CGFloat, fill fillColor: NSColor, stroke: NSColor? = nil, width: CGFloat = 2) {
  let path = NSBezierPath(roundedRect: rect, xRadius: radius, yRadius: radius)
  fillColor.setFill()
  path.fill()
  if let stroke {
    stroke.setStroke()
    path.lineWidth = width
    path.stroke()
  }
}

func circle(center: NSPoint, radius: CGFloat, fill fillColor: NSColor, glow: NSColor? = nil) {
  if let glow {
    glow.setFill()
    NSBezierPath(ovalIn: NSRect(
      x: center.x - radius * 1.8,
      y: center.y - radius * 1.8,
      width: radius * 3.6,
      height: radius * 3.6
    )).fill()
  }
  fillColor.setFill()
  NSBezierPath(ovalIn: NSRect(
    x: center.x - radius,
    y: center.y - radius,
    width: radius * 2,
    height: radius * 2
  )).fill()
}

func drawText(_ string: String, font: NSFont, color: NSColor, in rect: NSRect, alignment: NSTextAlignment = .left, tracking: CGFloat = 0) {
  let para = NSMutableParagraphStyle()
  para.alignment = alignment
  para.lineBreakMode = .byTruncatingTail
  var attrs: [NSAttributedString.Key: Any] = [
    .font: font,
    .foregroundColor: color,
    .paragraphStyle: para,
  ]
  if tracking != 0 {
    attrs[.kern] = tracking
  }
  let ns = NSString(string: string)
  let size = ns.size(withAttributes: attrs)
  let drawRect = NSRect(
    x: rect.origin.x,
    y: rect.origin.y + (rect.height - size.height) / 2,
    width: rect.width,
    height: size.height
  )
  ns.draw(in: drawRect, withAttributes: attrs)
}

func font(named names: [String], size: CGFloat, weight: NSFont.Weight = .bold) -> NSFont {
  for name in names {
    if let match = NSFont(name: name, size: size) { return match }
  }
  return NSFont.systemFont(ofSize: size, weight: weight)
}

func drawLight(in rect: NSRect, on: String) {
  rounded(rect, radius: rect.width * 0.28, fill: housing, stroke: housingStroke, width: max(2, rect.width * 0.04))
  let cx = rect.midX
  let r = rect.width * 0.18
  let lamps = [
    ("green", green, rect.minY + rect.height * 0.25),
    ("yellow", yellow, rect.minY + rect.height * 0.5),
    ("red", red, rect.minY + rect.height * 0.75),
  ]
  for (name, lit, y) in lamps {
    if name == on {
      circle(center: NSPoint(x: cx, y: y), radius: r * 1.15, fill: lit.withAlphaComponent(0.22))
      circle(center: NSPoint(x: cx, y: y), radius: r, fill: lit, glow: lit.withAlphaComponent(0.28))
    } else {
      circle(center: NSPoint(x: cx, y: y), radius: r, fill: dimLamp)
    }
  }
}

func write(_ data: Data, name: String) {
  let url = publicDir.appendingPathComponent(name)
  try! data.write(to: url)
  print("wrote \(url.path)")
}

let og = render(width: 1200, height: 630) {
  fill(NSRect(x: 0, y: 0, width: 1200, height: 630), void)
  color(0xFF2D4A, alpha: 0.18).setFill()
  NSBezierPath(ovalIn: NSRect(x: 140, y: -120, width: 920, height: 340)).fill()
  color(0x22E38A, alpha: 0.1).setFill()
  NSBezierPath(ovalIn: NSRect(x: 280, y: 430, width: 700, height: 280)).fill()

  drawLight(in: NSRect(x: 118, y: 95, width: 250, height: 440), on: "red")

  let display = font(named: ["Arial-Black", "HelveticaNeue-Bold", "Impact"], size: 78)
  let tag = font(named: ["HelveticaNeue-Bold", "Arial-BoldMT"], size: 28, weight: .semibold)
  let small = font(named: ["HelveticaNeue-Bold", "Arial-BoldMT"], size: 16, weight: .semibold)

  drawText("60 SECONDS", font: small, color: mute, in: NSRect(x: 430, y: 455, width: 700, height: 28), tracking: 8)
  drawText("STOPLIGHT", font: display, color: cream, in: NSRect(x: 430, y: 348, width: 720, height: 92))
  drawText("SIMULATOR", font: display, color: cream, in: NSRect(x: 430, y: 258, width: 720, height: 92))
  drawText("How far can you get?", font: tag, color: yellow, in: NSRect(x: 430, y: 198, width: 720, height: 40))
  drawText("Hold to drive. Let go to brake. Don’t run the red.", font: small, color: mute, in: NSRect(x: 430, y: 158, width: 720, height: 24))
}

func icon(size: Int, padding: CGFloat) -> Data {
  render(width: size, height: size) {
    let bounds = NSRect(x: 0, y: 0, width: size, height: size)
    rounded(bounds, radius: CGFloat(size) * 0.22, fill: void)
    let s = CGFloat(size)
    let height = s * (1 - padding * 2)
    let width = height * 0.42
    drawLight(
      in: NSRect(x: (s - width) / 2, y: (s - height) / 2, width: width, height: height),
      on: "red"
    )
  }
}

write(og, name: "og.png")
write(icon(size: 180, padding: 0.22), name: "apple-touch-icon.png")
write(icon(size: 192, padding: 0.22), name: "icon-192.png")
write(icon(size: 512, padding: 0.22), name: "icon-512.png")
write(icon(size: 512, padding: 0.28), name: "icon-512-maskable.png")
