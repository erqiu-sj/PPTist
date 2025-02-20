import { ref } from 'vue'
import { storeToRefs } from 'pinia'
import { trim } from 'lodash'
import { saveAs } from 'file-saver'
import pptxgen from 'pptxgenjs'
import tinycolor from 'tinycolor2'
import { toPng, toJpeg } from 'html-to-image'
import { useSlidesStore } from '@/store'
import { PPTElementOutline, PPTElementShadow, PPTElementLink } from '@/types/slides'
import { getElementRange, getLineElementPath, getTableSubThemeColor } from '@/utils/element'
import { AST, toAST } from '@/utils/htmlParser'
import { SvgPoints, toPoints } from '@/utils/svgPathParser'
import { svg2Base64 } from '@/utils/svg2Base64'
import { message } from 'ant-design-vue'

interface ExportImageConfig {
  quality: number;
  width: number;
  fontEmbedCSS?: string;
}

export default () => {
  const { slides, theme } = storeToRefs(useSlidesStore())

  const exporting = ref(false)

  // 导出图片
  const exportImage = (domRef: HTMLElement, format: string, quality: number, ignoreWebfont = true) => {
    exporting.value = true
    const toImage = format === 'png' ? toPng : toJpeg

    const foreignObjectSpans = domRef.querySelectorAll('foreignObject [xmlns]')
    foreignObjectSpans.forEach(spanRef => spanRef.removeAttribute('xmlns'))

    setTimeout(() => {
      const config: ExportImageConfig = {
        quality,
        width: 1600,
      }

      if (ignoreWebfont) config.fontEmbedCSS = ''

      toImage(domRef, config).then(dataUrl => {
        exporting.value = false
        saveAs(dataUrl, `pptist_slides.${format}`)
      }).catch(() => {
        exporting.value = false
        message.error('导出图片失败')
      })
    }, 200)
  }
  
  // 导出JSON文件
  const exportJSON = () => {
    const blob = new Blob([JSON.stringify(slides.value)], { type: '' })
    saveAs(blob, 'pptist_slides.json')
  }

  // 格式化颜色值为 透明度 + HexString，供pptxgenjs使用
  const formatColor = (_color: string) => {
    const c = tinycolor(_color)
    const alpha = c.getAlpha()
    const color = alpha === 0 ? '#ffffff' : c.setAlpha(1).toHexString()
    return {
      alpha,
      color,
    }
  }

  type FormatColor = ReturnType<typeof formatColor>

  // 将HTML字符串格式化为pptxgenjs所需的格式
  // 核心思路：将HTML字符串按样式分片平铺，每个片段需要继承祖先元素的样式信息，遇到块级元素需要换行
  const formatHTML = (html: string) => {
    const ast = toAST(html)
    let bulletFlag = false

    const slices: pptxgen.TextProps[] = []
    const parse = (obj: AST[], baseStyleObj = {}) => {

      for (const item of obj) {
        const isBlockTag = 'tagName' in item && ['div', 'li', 'p'].includes(item.tagName)

        if (isBlockTag && slices.length) {
          const lastSlice = slices[slices.length - 1]
          if (!lastSlice.options) lastSlice.options = {}
          lastSlice.options.breakLine = true
        }

        const styleObj = { ...baseStyleObj }
        const styleAttr = 'attributes' in item ? item.attributes.find(attr => attr.key === 'style') : null
        if (styleAttr && styleAttr.value) {
          const styleArr = styleAttr.value.split(';')
          for (const styleItem of styleArr) {
            const [_key, _value] = styleItem.split(': ')
            const [key, value] = [trim(_key), trim(_value)]
            if (key && value) styleObj[key] = value
          }
        }

        if ('tagName' in item) {
          if (item.tagName === 'em') {
            styleObj['font-style'] = 'italic'
          }
          if (item.tagName === 'strong') {
            styleObj['font-weight'] = 'bold'
          }
          if (item.tagName === 'sup') {
            styleObj['vertical-align'] = 'super'
          }
          if (item.tagName === 'sub') {
            styleObj['vertical-align'] = 'sub'
          }
          if (item.tagName === 'a') {
            const attr = item.attributes.find(attr => attr.key === 'href')
            styleObj['href'] = attr?.value || ''
          }
          if (item.tagName === 'ul') {
            styleObj['list-type'] = 'ul'
          }
          if (item.tagName === 'ol') {
            styleObj['list-type'] = 'ol'
          }
          if (item.tagName === 'li') {
            bulletFlag = true
          }
        }

        if ('tagName' in item && item.tagName === 'br') {
          slices.push({ text: '', options: { breakLine: true } })
        }
        else if ('content' in item) {
          const text = item.content.replace(/&nbsp;/g, ' ').replace(/&gt;/g, '>').replace(/&lt;/g, '<').replace(/&amp;/g, '&').replace(/\n/g, '')
          const options: pptxgen.TextPropsOptions = {}

          if (styleObj['font-size']) {
            options.fontSize = parseInt(styleObj['font-size']) * 0.75
          }
          if (styleObj['color']) {
            options.color = formatColor(styleObj['color']).color
          }
          if (styleObj['background-color']) {
            options.highlight = formatColor(styleObj['background-color']).color
          }
          if (styleObj['text-decoration-line']) {
            if (styleObj['text-decoration-line'].indexOf('underline') !== -1) {
              options.underline = {
                color: options.color || '#000000',
                style: 'sng',
              }
            }
            if (styleObj['text-decoration-line'].indexOf('line-through') !== -1) {
              options.strike = 'sngStrike'
            }
          }
          if (styleObj['text-decoration']) {
            if (styleObj['text-decoration'].indexOf('underline') !== -1) {
              options.underline = {
                color: options.color || '#000000',
                style: 'sng',
              }
            }
            if (styleObj['text-decoration'].indexOf('line-through') !== -1) {
              options.strike = 'sngStrike'
            }
          }
          if (styleObj['vertical-align']) {
            if (styleObj['vertical-align'] === 'super') options.superscript = true
            if (styleObj['vertical-align'] === 'sub') options.subscript = true
          }
          if (styleObj['text-align']) options.align = styleObj['text-align']
          if (styleObj['font-weight']) options.bold = styleObj['font-weight'] === 'bold'
          if (styleObj['font-style']) options.italic = styleObj['font-style'] === 'italic'
          if (styleObj['font-family']) options.fontFace = styleObj['font-family']
          if (styleObj['href']) options.hyperlink = { url: styleObj['href'] }

          if (bulletFlag && styleObj['list-type'] === 'ol') {
            options.bullet = { type: 'number', indent: 20 * 0.75 }
            bulletFlag = false
          }
          if (bulletFlag && styleObj['list-type'] === 'ul') {
            options.bullet = { indent: 20 * 0.75 }
            bulletFlag = false
          }

          slices.push({ text, options })
        }
        else if ('children' in item) parse(item.children, styleObj)
      }
    }
    parse(ast)
    return slices
  }

  type Points = Array<
    | { x: number; y: number; moveTo?: boolean }
    | { x: number; y: number; curve: { type: 'arc'; hR: number; wR: number; stAng: number; swAng: number } }
    | { x: number; y: number; curve: { type: 'quadratic'; x1: number; y1: number } }
    | { x: number; y: number; curve: { type: 'cubic'; x1: number; y1: number; x2: number; y2: number } }
    | { close: true }
  >

  // 将SVG路径信息格式化为pptxgenjs所需要的格式
  const formatPoints = (points: SvgPoints, scale = { x: 1, y: 1 }): Points => {
    return points.map(point => {
      if (point.close !== undefined) {
        return { close: true }
      }
      else if (point.type === 'M') {
        return {
          x: point.x / 100 * scale.x,
          y: point.y / 100 * scale.y,
          moveTo: true,
        }
      }
      else if (point.curve) {
        if (point.curve.type === 'cubic') {
          return {
            x: point.x / 100 * scale.x,
            y: point.y / 100 * scale.y,
            curve: {
              type: 'cubic',
              x1: (point.curve.x1 as number) / 100 * scale.x,
              y1: (point.curve.y1 as number) / 100 * scale.y,
              x2: (point.curve.x2 as number) / 100 * scale.x,
              y2: (point.curve.y2 as number) / 100 * scale.y,
            },
          }
        }
        else if (point.curve.type === 'quadratic') {
          return {
            x: point.x / 100 * scale.x,
            y: point.y / 100 * scale.y,
            curve: {
              type: 'quadratic',
              x1: (point.curve.x1 as number) / 100 * scale.x,
              y1: (point.curve.y1 as number) / 100 * scale.y,
            },
          }
        }
      }
      return {
        x: point.x / 100 * scale.x,
        y: point.y / 100 * scale.y,
      }
    })
  }

  // 获取阴影配置
  const getShadowOption = (shadow: PPTElementShadow): pptxgen.ShadowProps => {
    const c = formatColor(shadow.color)
    const { h, v } = shadow

    let offset = 4
    let angle = 45

    if (h === 0 && v === 0) {
      offset = 4
      angle = 45
    }
    else if (h === 0) {
      if (v > 0) {
        offset = v
        angle = 90
      }
      else {
        offset = -v
        angle = 270
      }
    }
    else if (v === 0) {
      if (h > 0) {
        offset = h
        angle = 1
      }
      else {
        offset = -h
        angle = 180
      }
    }
    else if (h > 0 && v > 0) {
      offset = Math.max(h, v)
      angle = 45
    }
    else if (h > 0 && v < 0) {
      offset = Math.max(h, -v)
      angle = 315
    }
    else if (h < 0 && v > 0) {
      offset = Math.max(-h, v)
      angle = 135
    }
    else if (h < 0 && v < 0) {
      offset = Math.max(-h, -v)
      angle = 225
    }

    return {
      type: 'outer',
      color: c.color.replace('#', ''),
      opacity: c.alpha,
      blur: shadow.blur * 0.75,
      offset,
      angle,
    }
  }

  // 获取边框配置
  const getOutlineOption = (outline: PPTElementOutline): pptxgen.ShapeLineProps => {
    const c = formatColor(outline?.color || '#000000')
    return {
      color: c.color, 
      transparency: (1 - c.alpha) * 100,
      width: (outline.width || 1) * 0.75, 
      dashType: outline.style === 'solid' ? 'solid' : 'dash',
    }
  }

  // 获取超链接配置
  const getLinkOption = (link: PPTElementLink): pptxgen.HyperlinkProps | null => {
    const { type, target } = link
    if (type === 'web') return { url: target }
    if (type === 'slide') {
      const index = slides.value.findIndex(slide => slide.id === target)
      if (index !== -1) return { slide: index + 1 }
    }

    return null
  }

  // 导出PPTX文件
  const exportPPTX = () => {
    exporting.value = true
    const pptx = new pptxgen()

    const { color: bgColor, alpha: bgAlpha } = formatColor(theme.value.backgroundColor)
    pptx.defineSlideMaster({
      title: 'PPTIST_MASTER',
      background: { color: bgColor, transparency: (1 - bgAlpha) * 100 },
    })

    for (const slide of slides.value) {
      const pptxSlide = pptx.addSlide()

      if (slide.background) {
        const background = slide.background
        if (background.type === 'image' && background.image) {
          pptxSlide.background = { data: background.image }
        }
        else if (background.type === 'solid' && background.color) {
          const c = formatColor(background.color)
          pptxSlide.background = { color: c.color, transparency: (1 - c.alpha) * 100 }
        }
        else if (background.type === 'gradient' && background.gradientColor) {
          const [color1, color2] = background.gradientColor
          const color = tinycolor.mix(color1, color2).toHexString()
          const c = formatColor(color)
          pptxSlide.background = { color: c.color, transparency: (1 - c.alpha) * 100 }
        }
      }
      if (slide.remark) pptxSlide.addNotes(slide.remark)

      if (!slide.elements) continue

      for (const el of slide.elements) {
        if (el.type === 'text') {
          const textProps = formatHTML(el.content)

          const options: pptxgen.TextPropsOptions = {
            x: el.left / 100,
            y: el.top / 100,
            w: el.width / 100,
            h: el.height / 100,
            fontSize: 20 * 0.75,
            fontFace: '微软雅黑',
            color: '#000000',
            valign: 'middle',
            margin: 10 * 0.75,
            lineSpacingMultiple: 1.5 / 1.2,
          }
          if (el.rotate) options.rotate = el.rotate
          if (el.wordSpace) options.charSpacing = el.wordSpace * 0.75
          if (el.lineHeight) options.lineSpacingMultiple = el.lineHeight / 1.2
          if (el.fill) {
            const c = formatColor(el.fill)
            const opacity = el.opacity === undefined ? 1 : el.opacity
            options.fill = { color: c.color, transparency: (1 - c.alpha * opacity) * 100 }
          }
          if (el.defaultColor) options.color = formatColor(el.defaultColor).color
          if (el.defaultFontName) options.fontFace = el.defaultFontName
          if (el.shadow) options.shadow = getShadowOption(el.shadow)
          if (el.outline?.width) options.line = getOutlineOption(el.outline)
          if (el.opacity !== undefined) options.transparency = (1 - el.opacity) * 100

          pptxSlide.addText(textProps, options)
        }

        else if (el.type === 'image') {
          const options: pptxgen.ImageProps = {
            path: el.src,
            x: el.left / 100,
            y: el.top / 100,
            w: el.width / 100,
            h: el.height / 100,
          }
          if (el.flipH) options.flipH = el.flipH
          if (el.flipV) options.flipV = el.flipV
          if (el.rotate) options.rotate = el.rotate
          if (el.link) {
            const linkOption = getLinkOption(el.link)
            if (linkOption) options.hyperlink = linkOption
          }
          if (el.filters?.opacity) options.transparency = 100 - parseInt(el.filters?.opacity)
          if (el.clip) {
            if (el.clip.shape === 'ellipse') options.rounding = true

            const [start, end] = el.clip.range
            const [startX, startY] = start
            const [endX, endY] = end

            const originW = el.width / ((endX - startX) / 100)
            const originH = el.height / ((endY - startY) / 100)

            options.w = originW / 100
            options.h = originH / 100

            options.sizing = {
              type: 'crop',
              x: startX / 100 * originW / 100,
              y: startY / 100 * originH / 100,
              w: (endX - startX) / 100 * originW / 100,
              h: (endY - startY) / 100 * originH / 100,
            }
          }

          pptxSlide.addImage(options)
        }

        else if (el.type === 'shape') {
          if (el.special) {
            const svgRef = document.querySelector(`.thumbnail-list .base-element-${el.id} svg`) as HTMLElement
            const base64SVG = svg2Base64(svgRef)

            const options: pptxgen.ImageProps = {
              data: base64SVG,
              x: el.left / 100,
              y: el.top / 100,
              w: el.width / 100,
              h: el.height / 100,
            }
            if (el.rotate) options.rotate = el.rotate
            if (el.link) {
              const linkOption = getLinkOption(el.link)
              if (linkOption) options.hyperlink = linkOption
            }

            pptxSlide.addImage(options)
          }
          else {
            const scale = {
              x: el.width / el.viewBox[0],
              y: el.height / el.viewBox[1],
            }
            const points = formatPoints(toPoints(el.path), scale)
  
            const fillColor = formatColor(el.fill)
            const opacity = el.opacity === undefined ? 1 : el.opacity
  
            const options: pptxgen.ShapeProps = {
              x: el.left / 100,
              y: el.top / 100,
              w: el.width / 100,
              h: el.height / 100,
              fill: { color: fillColor.color, transparency: (1 - fillColor.alpha * opacity) * 100 },
              points,
            }
            if (el.flipH) options.flipH = el.flipH
            if (el.flipV) options.flipV = el.flipV
            if (el.shadow) options.shadow = getShadowOption(el.shadow)
            if (el.outline?.width) options.line = getOutlineOption(el.outline)
            if (el.link) {
              const linkOption = getLinkOption(el.link)
              if (linkOption) options.hyperlink = linkOption
            }

            pptxSlide.addShape('custGeom' as pptxgen.ShapeType, options)
          }
          if (el.text) {
            const textProps = formatHTML(el.text.content)

            const options: pptxgen.TextPropsOptions = {
              x: el.left / 100,
              y: el.top / 100,
              w: el.width / 100,
              h: el.height / 100,
              fontSize: 20 * 0.75,
              fontFace: '微软雅黑',
              color: '#000000',
              valign: el.text.align,
            }
            if (el.rotate) options.rotate = el.rotate
            if (el.text.defaultColor) options.color = formatColor(el.text.defaultColor).color
            if (el.text.defaultFontName) options.fontFace = el.text.defaultFontName

            pptxSlide.addText(textProps, options)
          }
        }

        else if (el.type === 'line') {
          const path = getLineElementPath(el)
          const points = formatPoints(toPoints(path))
          const { minX, maxX, minY, maxY } = getElementRange(el)
          const c = formatColor(el.color)

          const options: pptxgen.ShapeProps = {
            x: el.left / 100,
            y: el.top / 100,
            w: (maxX - minX) / 100,
            h: (maxY - minY) / 100,
            line: {
              color: c.color, 
              transparency: (1 - c.alpha) * 100,
              width: el.width * 0.75, 
              dashType: el.style === 'solid' ? 'solid' : 'dash',
              beginArrowType: el.points[0] ? 'arrow' : 'none',
              endArrowType: el.points[1] ? 'arrow' : 'none',
            },
            points,
          }
          if (el.shadow) options.shadow = getShadowOption(el.shadow)

          pptxSlide.addShape('custGeom' as pptxgen.ShapeType, options)
        }

        else if (el.type === 'chart') {
          const chartData = []
          for (let i = 0; i < el.data.series.length; i++) {
            const item = el.data.series[i]
            chartData.push({
              name: `系列${i + 1}`,
              labels: el.data.labels,
              values: item,
            })
          }

          let chartColors: string[] = []
          if (el.themeColor.length === 10) chartColors = el.themeColor.map(color => formatColor(color).color)
          else if (el.themeColor.length === 1) chartColors = tinycolor(el.themeColor[0]).analogous(10).map(color => formatColor(color.toHexString()).color)
          else {
            const len = el.themeColor.length
            const supplement = tinycolor(el.themeColor[len - 1]).analogous(10 + 1 - len).map(color => color.toHexString())
            chartColors = [...el.themeColor.slice(0, len - 1), ...supplement].map(color => formatColor(color).color)
          }
          
          const options: pptxgen.IChartOpts = {
            x: el.left / 100,
            y: el.top / 100,
            w: el.width / 100,
            h: el.height / 100,
            chartColors: el.chartType === 'pie' ? chartColors : chartColors.slice(0, el.data.series.length),
          }

          if (el.fill) options.fill = formatColor(el.fill).color
          if (el.legend) {
            options.showLegend = true
            options.legendPos = el.legend === 'top' ? 't' : 'b'
            options.legendColor = formatColor(el.gridColor || '#000000').color
            options.legendFontSize = 14 * 0.75
          }

          let type = pptx.ChartType.bar
          if (el.chartType === 'bar') {
            type = pptx.ChartType.bar
            options.barDir = el.options?.horizontalBars ? 'bar' : 'col'
          }
          else if (el.chartType === 'line') {
            if (el.options?.showArea) type = pptx.ChartType.area
            else if (el.options?.showLine === false) {
              type = pptx.ChartType.scatter

              chartData.unshift({ name: 'X-Axis', values: Array(el.data.series[0].length).fill(0).map((v, i) => i) })
              options.lineSize = 0
            }
            else type = pptx.ChartType.line

            if (el.options?.lineSmooth) options.lineSmooth = true
          }
          else if (el.chartType === 'pie') {
            if (el.options?.donut) {
              type = pptx.ChartType.doughnut
              options.holeSize = 75
            }
            else type = pptx.ChartType.pie
          }
          
          pptxSlide.addChart(type, chartData, options)
        }

        else if (el.type === 'table') {
          const hiddenCells = []
          for (let i = 0; i < el.data.length; i++) {
            const rowData = el.data[i]

            for (let j = 0; j < rowData.length; j++) {
              const cell = rowData[j]
              if (cell.colspan > 1 || cell.rowspan > 1) {
                for (let row = i; row < i + cell.rowspan; row++) {
                  for (let col = row === i ? j + 1 : j; col < j + cell.colspan; col++) hiddenCells.push(`${row}_${col}`)
                }
              }
            }
          }

          const tableData = []

          const theme = el.theme
          let themeColor: FormatColor | null = null
          let subThemeColors: FormatColor[] = []
          if (theme) {
            themeColor = formatColor(theme.color)
            subThemeColors = getTableSubThemeColor(theme.color).map(item => formatColor(item))
          }

          for (let i = 0; i < el.data.length; i++) {
            const row = el.data[i]
            const _row = []

            for (let j = 0; j < row.length; j++) {
              const cell = row[j]
              const cellOptions: pptxgen.TableCellProps = {
                colspan: cell.colspan,
                rowspan: cell.rowspan,
                bold: cell.style?.bold || false,
                italic: cell.style?.em || false,
                underline: { style: cell.style?.underline ? 'sng' : 'none' },
                align: cell.style?.align || 'left',
                valign: 'middle',
                fontFace: cell.style?.fontname || '微软雅黑',
                fontSize: (cell.style?.fontsize ? parseInt(cell.style?.fontsize) : 14) * 0.75,
              }
              if (theme && themeColor) {
                let c: FormatColor
                if (i % 2 === 0) c = subThemeColors[1]
                else c = subThemeColors[0]

                if (theme.rowHeader && i === 0) c = themeColor
                else if (theme.rowFooter && i === el.data.length - 1) c = themeColor
                else if (theme.colHeader && j === 0) c = themeColor
                else if (theme.colFooter && j === row.length - 1) c = themeColor

                cellOptions.fill = { color: c.color, transparency: (1 - c.alpha) * 100 }
              }
              if (cell.style?.backcolor) {
                const c = formatColor(cell.style.backcolor)
                cellOptions.fill = { color: c.color, transparency: (1 - c.alpha) * 100 }
              }
              if (cell.style?.color) cellOptions.color = formatColor(cell.style.color).color

              if (!hiddenCells.includes(`${i}_${j}`)) {
                _row.push({
                  text: cell.text,
                  options: cellOptions,
                })
              }
            }
            if (_row.length) tableData.push(_row)
          }

          const options: pptxgen.TableProps = {
            x: el.left / 100,
            y: el.top / 100,
            w: el.width / 100,
            h: el.height / 100,
            colW: el.colWidths.map(item => el.width * item / 100),
          }
          if (el.theme) options.fill = { color: '#ffffff' }
          if (el.outline.width && el.outline.color) {
            options.border = {
              type: el.outline.style === 'solid' ? 'solid' : 'dash',
              pt: el.outline.width * 0.75,
              color: formatColor(el.outline.color).color,
            }
          }

          pptxSlide.addTable(tableData, options)
        }
        
        else if (el.type === 'latex') {
          const svgRef = document.querySelector(`.thumbnail-list .base-element-${el.id} svg`) as HTMLElement
          const base64SVG = svg2Base64(svgRef)

          const options: pptxgen.ImageProps = {
            data: base64SVG,
            x: el.left / 100,
            y: el.top / 100,
            w: el.width / 100,
            h: el.height / 100,
          }
          if (el.link) {
            const linkOption = getLinkOption(el.link)
            if (linkOption) options.hyperlink = linkOption
          }

          pptxSlide.addImage(options)
        }
      }
    }
    pptx.writeFile({ fileName: `pptist.pptx` }).then(() => exporting.value = false).catch(() => {
      exporting.value = false
      message.error('导出失败')
    })
  }

  return {
    exporting,
    exportImage,
    exportJSON,
    exportPPTX,
  }
}