<template>
  <div class="text-style-panel">
    <div class="preset-style">
      <div 
        class="preset-style-item"
        v-for="item in presetStyles"
        :key="item.label"
        :style="item.style"
        @click="emitBatchRichTextCommand(item.cmd)"
      >{{item.label}}</div>
    </div>

    <Divider />
    
    <InputGroup compact class="row">
      <Select
        style="flex: 3;"
        :value="richTextAttrs.fontname"
        @change="value => emitRichTextCommand('fontname', value)"
      >
        <template #suffixIcon><IconFontSize /></template>
        <SelectOptGroup label="系统字体">
          <SelectOption v-for="font in availableFonts" :key="font.value" :value="font.value">
            <span :style="{ fontFamily: font.value }">{{font.label}}</span>
          </SelectOption>
        </SelectOptGroup>
        <SelectOptGroup label="在线字体">
          <SelectOption v-for="font in webFonts" :key="font.value" :value="font.value">
            <span>{{font.label}}</span>
          </SelectOption>
        </SelectOptGroup>
      </Select>
      <Select
        style="flex: 2;"
        :value="richTextAttrs.fontsize"
        @change="value => emitRichTextCommand('fontsize', value)"
      >
        <template #suffixIcon><IconAddText /></template>
        <SelectOption v-for="fontsize in fontSizeOptions" :key="fontsize" :value="fontsize">
          {{fontsize}}
        </SelectOption>
      </Select>
    </InputGroup>

    <ButtonGroup class="row">
      <Popover trigger="click">
        <template #content>
          <ColorPicker
            :modelValue="richTextAttrs.color"
            @update:modelValue="value => emitRichTextCommand('color', value)"
          />
        </template>
        <Tooltip :mouseLeaveDelay="0" :mouseEnterDelay="0.5" title="文字颜色">
          <Button class="text-color-btn" style="flex: 1;">
            <IconText />
            <div class="text-color-block" :style="{ backgroundColor: richTextAttrs.color }"></div>
          </Button>
        </Tooltip>
      </Popover>
      <Popover trigger="click">
        <template #content>
          <ColorPicker
            :modelValue="richTextAttrs.backcolor"
            @update:modelValue="value => emitRichTextCommand('backcolor', value)"
          />
        </template>
        <Tooltip :mouseLeaveDelay="0" :mouseEnterDelay="0.5" title="文字高亮">
          <Button class="text-color-btn" style="flex: 1;">
            <IconBackgroundColor />
            <div class="text-color-block" :style="{ backgroundColor: richTextAttrs.backcolor }"></div>
          </Button>
        </Tooltip>
      </Popover>
      <Popover trigger="click">
        <template #content>
          <ColorPicker
            :modelValue="fill"
            @update:modelValue="value => updateFill(value)"
          />
        </template>
        <Tooltip :mouseLeaveDelay="0" :mouseEnterDelay="0.5" title="文本框填充">
          <Button class="text-color-btn" style="flex: 1;">
            <IconFill />
            <div class="text-color-block" :style="{ backgroundColor: fill }"></div>
          </Button>
        </Tooltip>
      </Popover>
    </ButtonGroup>

    <CheckboxButtonGroup class="row">
      <Tooltip :mouseLeaveDelay="0" :mouseEnterDelay="0.5" title="加粗">
        <CheckboxButton 
          style="flex: 1;"
          :checked="richTextAttrs.bold"
          @click="emitRichTextCommand('bold')"
        ><IconTextBold /></CheckboxButton>
      </Tooltip>
      <Tooltip :mouseLeaveDelay="0" :mouseEnterDelay="0.5" title="斜体">
        <CheckboxButton 
          style="flex: 1;"
          :checked="richTextAttrs.em"
          @click="emitRichTextCommand('em')"
        ><IconTextItalic /></CheckboxButton>
      </Tooltip>
      <Tooltip :mouseLeaveDelay="0" :mouseEnterDelay="0.5" title="下划线">
        <CheckboxButton 
          style="flex: 1;"
          :checked="richTextAttrs.underline"
          @click="emitRichTextCommand('underline')"
        ><IconTextUnderline /></CheckboxButton>
      </Tooltip>
      <Tooltip :mouseLeaveDelay="0" :mouseEnterDelay="0.5" title="删除线">
        <CheckboxButton 
          style="flex: 1;"
          :checked="richTextAttrs.strikethrough"
          @click="emitRichTextCommand('strikethrough')"
        ><IconStrikethrough /></CheckboxButton>
      </Tooltip>
      <Tooltip :mouseLeaveDelay="0" :mouseEnterDelay="0.5" title="清除格式">
        <CheckboxButton
          style="flex: 1;"
          @click="emitRichTextCommand('clear')"
        ><IconFormat /></CheckboxButton>
      </Tooltip>
    </CheckboxButtonGroup>

    <CheckboxButtonGroup class="row">
      <Tooltip :mouseLeaveDelay="0" :mouseEnterDelay="0.5" title="上标">
        <CheckboxButton
          style="flex: 1;"
          :checked="richTextAttrs.superscript"
          @click="emitRichTextCommand('superscript')"
        ><IconUpOne /></CheckboxButton>
      </Tooltip>
      <Tooltip :mouseLeaveDelay="0" :mouseEnterDelay="0.5" title="下标">
        <CheckboxButton
          style="flex: 1;"
          :checked="richTextAttrs.subscript"
          @click="emitRichTextCommand('subscript')"
        ><IconDownOne /></CheckboxButton>
      </Tooltip>
      <Tooltip :mouseLeaveDelay="0" :mouseEnterDelay="0.5" title="行内代码">
        <CheckboxButton
          style="flex: 1;"
          :checked="richTextAttrs.code"
          @click="emitRichTextCommand('code')"
        ><IconCode /></CheckboxButton>
      </Tooltip>
      <Tooltip :mouseLeaveDelay="0" :mouseEnterDelay="0.5" title="引用">
        <CheckboxButton
          style="flex: 1;"
          :checked="richTextAttrs.blockquote"
          @click="emitRichTextCommand('blockquote')"
        ><IconQuote /></CheckboxButton>
      </Tooltip>
      <Tooltip :mouseLeaveDelay="0" :mouseEnterDelay="0.5" title="超链接">
        <Popover placement="bottomRight" trigger="click" v-model:visible="linkPopoverVisible">
          <template #content>
            <div class="link-popover">
              <Input v-model:value="link" placeholder="请输入超链接" />
              <div class="btns">
                <Button size="small" :disabled="!richTextAttrs.link" @click="updateLink()" style="margin-right: 5px;">移除</Button>
                <Button size="small" type="primary" @click="updateLink(link)">确认</Button>
              </div>
            </div>
          </template>
          <CheckboxButton
            style="flex: 1;"
            :checked="!!richTextAttrs.link"
            @click="openLinkPopover()"
          ><IconLinkOne /></CheckboxButton>
        </Popover>
      </Tooltip>
    </CheckboxButtonGroup>

    <Divider />

    <RadioGroup 
      class="row" 
      button-style="solid" 
      :value="richTextAttrs.align"
      @change="e => emitRichTextCommand('align', e.target.value)"
    >
      <Tooltip :mouseLeaveDelay="0" :mouseEnterDelay="0.5" title="左对齐">
        <RadioButton value="left" style="flex: 1;"><IconAlignTextLeft /></RadioButton>
      </Tooltip>
      <Tooltip :mouseLeaveDelay="0" :mouseEnterDelay="0.5" title="居中">
        <RadioButton value="center" style="flex: 1;"><IconAlignTextCenter /></RadioButton>
      </Tooltip>
      <Tooltip :mouseLeaveDelay="0" :mouseEnterDelay="0.5" title="右对齐">
        <RadioButton value="right" style="flex: 1;"><IconAlignTextRight /></RadioButton>
      </Tooltip>
    </RadioGroup>

    <CheckboxButtonGroup class="row">
      <Tooltip :mouseLeaveDelay="0" :mouseEnterDelay="0.5" title="项目符号">
        <CheckboxButton 
          style="flex: 1;" 
          :checked="richTextAttrs.bulletList"
          @click="emitRichTextCommand('bulletList')"
        ><IconList /></CheckboxButton>
      </Tooltip>
      <Tooltip :mouseLeaveDelay="0" :mouseEnterDelay="0.5" title="编号">
        <CheckboxButton 
          style="flex: 1;" 
          :checked="richTextAttrs.orderedList"
          @click="emitRichTextCommand('orderedList')"
        ><IconOrderedList /></CheckboxButton>
      </Tooltip>
    </CheckboxButtonGroup>

    <Divider />

    <div class="row">
      <div style="flex: 2;">行间距：</div>
      <Select style="flex: 3;" :value="lineHeight" @change="value => updateLineHeight(value)">
        <template #suffixIcon><IconRowHeight /></template>
        <SelectOption v-for="item in lineHeightOptions" :key="item" :value="item">{{item}}倍</SelectOption>
      </Select>
    </div>
    <div class="row">
      <div style="flex: 2;">字间距：</div>
      <Select style="flex: 3;" :value="wordSpace" @change="value => updateWordSpace(value)">
        <template #suffixIcon><IconFullwidth /></template>
        <SelectOption v-for="item in wordSpaceOptions" :key="item" :value="item">{{item}}px</SelectOption>
      </Select>
    </div>

    <Divider />
    <ElementOutline />
    <Divider />
    <ElementShadow />
    <Divider />
    <ElementOpacity />
  </div>
</template>

<script lang="ts">
import { defineComponent, ref, watch } from 'vue'
import { storeToRefs } from 'pinia'
import { useMainStore, useSlidesStore } from '@/store'
import { PPTTextElement } from '@/types/slides'
import emitter, { EmitterEvents, RichTextAction } from '@/utils/emitter'
import { WEB_FONTS } from '@/configs/font'
import useHistorySnapshot from '@/hooks/useHistorySnapshot'
import { message } from 'ant-design-vue'

import ElementOpacity from '../common/ElementOpacity.vue'
import ElementOutline from '../common/ElementOutline.vue'
import ElementShadow from '../common/ElementShadow.vue'

const presetStyles = [
  {
    label: '大标题',
    style: {
      fontSize: '26px',
      fontWeight: 700,
    },
    cmd: [
      { command: 'clear' },
      { command: 'fontsize', value: '48px' },
      { command: 'align', value: 'center' },
      { command: 'bold' },
    ],
  },
  {
    label: '小标题',
    style: {
      fontSize: '22px',
      fontWeight: 700,
    },
    cmd: [
      { command: 'clear' },
      { command: 'fontsize', value: '36px' },
      { command: 'align', value: 'center' },
      { command: 'bold' },
    ],
  },
  {
    label: '正文',
    style: {
      fontSize: '20px',
    },
    cmd: [
      { command: 'clear' },
      { command: 'fontsize', value: '20px' },
    ],
  },
  {
    label: '正文[小]',
    style: {
      fontSize: '18px',
    },
    cmd: [
      { command: 'clear' },
      { command: 'fontsize', value: '18px' },
    ],
  },
  {
    label: '注释 1',
    style: {
      fontSize: '16px',
      fontStyle: 'italic',
    },
    cmd: [
      { command: 'clear' },
      { command: 'fontsize', value: '16px' },
      { command: 'em' },
    ],
  },
  {
    label: '注释 2',
    style: {
      fontSize: '16px',
      textDecoration: 'underline',
    },
    cmd: [
      { command: 'clear' },
      { command: 'fontsize', value: '16px' },
      { command: 'underline' },
    ],
  },
]

const webFonts = WEB_FONTS

export default defineComponent({
  name: 'text-style-panel',
  components: {
    ElementOpacity,
    ElementOutline,
    ElementShadow,
  },
  setup() {
    const slidesStore = useSlidesStore()
    const { handleElement, handleElementId, richTextAttrs, availableFonts } = storeToRefs(useMainStore())

    const { addHistorySnapshot } = useHistorySnapshot()

    const updateElement = (props: Partial<PPTTextElement>) => {
      slidesStore.updateElement({ id: handleElementId.value, props })
      addHistorySnapshot()
    }

    const fill = ref<string>()
    const lineHeight = ref<number>()
    const wordSpace = ref<number>()

    watch(handleElement, () => {
      if (!handleElement.value || handleElement.value.type !== 'text') return

      fill.value = handleElement.value.fill || '#000'
      lineHeight.value = handleElement.value.lineHeight || 1.5
      wordSpace.value = handleElement.value.wordSpace || 0
    }, { deep: true, immediate: true })

    const fontSizeOptions = [
      '12px', '14px', '16px', '18px', '20px', '22px', '24px', '28px', '32px',
      '36px', '40px', '44px', '48px', '54px', '60px', '66px', '72px', '76px',
      '80px', '88px', '96px', '104px', '112px', '120px',
    ]
    const lineHeightOptions = [0.9, 1.0, 1.15, 1.2, 1.4, 1.5, 1.8, 2.0, 2.5, 3.0]
    const wordSpaceOptions = [0, 1, 2, 3, 4, 5, 6, 8, 10]

    // 设置行高
    const updateLineHeight = (value: number) => {
      updateElement({ lineHeight: value })
    }

    // 设置字间距
    const updateWordSpace = (value: number) => {
      updateElement({ wordSpace: value })
    }

    // 设置文本框填充
    const updateFill = (value: string) => {
      updateElement({ fill: value })
    }

    // 发射富文本设置命令
    const emitRichTextCommand = (command: string, value?: string) => {
      emitter.emit(EmitterEvents.RICH_TEXT_COMMAND, { action: { command, value } })
    }

    // 发射富文本设置命令（批量）
    const emitBatchRichTextCommand = (action: RichTextAction[]) => {
      emitter.emit(EmitterEvents.RICH_TEXT_COMMAND, { action })
    }

    // 设置富文本超链接
    const link = ref('')
    const linkPopoverVisible = ref(false)

    watch(richTextAttrs, () => linkPopoverVisible.value = false)

    const openLinkPopover = () => {
      link.value = richTextAttrs.value.link
      linkPopoverVisible.value = true
    }
    const updateLink = (link: string) => {
      if (link) {
        const linkRegExp = /^(https?):\/\/[\w\-]+(\.[\w\-]+)+([\w\-.,@?^=%&:\/~+#]*[\w\-@?^=%&\/~+#])?$/
        if (!linkRegExp.test(link)) return message.error('不是正确的网页链接地址')
      }
      emitRichTextCommand('link', link)
      linkPopoverVisible.value = false
    }

    return {
      fill,
      lineHeight,
      wordSpace,
      richTextAttrs,
      availableFonts,
      webFonts,
      fontSizeOptions,
      lineHeightOptions,
      wordSpaceOptions,
      updateLineHeight,
      updateWordSpace,
      updateFill,
      emitRichTextCommand,
      emitBatchRichTextCommand,
      presetStyles,
      link,
      linkPopoverVisible,
      openLinkPopover,
      updateLink,
    }
  },
})
</script>

<style lang="scss" scoped>
.text-style-panel {
  user-select: none;
}
.row {
  width: 100%;
  display: flex;
  align-items: center;
  margin-bottom: 10px;
}
.preset-style {
  display: flex;
  flex-wrap: wrap;
  margin-bottom: 10px;
}
.preset-style-item {
  width: 50%;
  height: 50px;
  border: solid 1px #d6d6d6;
  box-sizing: border-box;
  display: flex;
  justify-content: center;
  align-items: center;
  position: relative;
  cursor: pointer;
  transition: all $transitionDelay;

  &:hover {
    border-color: $themeColor;
    color: $themeColor;
    z-index: 1;
  }

  &:nth-child(2n) {
    margin-left: -1px;
  }
  &:nth-child(n+3) {
    margin-top: -1px;
  }
}
.text-color-btn {
  display: flex;
  flex-direction: column;
  justify-content: center;
  align-items: center;
}
.text-color-block {
  width: 16px;
  height: 3px;
  margin-top: 1px;
}
.link-popover {
  width: 240px;

  .btns {
    margin-top: 10px;
    text-align: right;
  }
}
</style>