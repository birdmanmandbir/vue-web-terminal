import {_getByteLen, _html, _isEmpty, _isSafari, _nonEmpty, _unHtml} from "./Util.js";
import historyStore from "./HistoryStore.js";
import TerminalObj from './TerminalObj.js'
import TerminalFlash from "./TerminalFlash.js";
import TerminalAsk from "@/TerminalAsk";

export default {
    name: 'Terminal',
    data() {
        return {
            terminalObj: TerminalObj,
            command: "",
            commandLog: [],
            cursorConf: {
                defaultWidth: 6,
                width: 6,
                left: 'unset',
                top: 'unset',
                idx: 0, //  从0开始
                show: false
            },
            byteLen: {
                en: 8, cn: 13
            },
            jsonViewDepth: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10],
            showInputLine: true,
            terminalLog: [],
            keydownListener: null,
            searchCmd: {
                item: null
            },
            allCommandStore: [
                {
                    key: 'help',
                    title: 'Help',
                    group: 'local',
                    usage: 'help [pattern]',
                    description: 'Show command document.',
                    example: [
                        {
                            des: "Get all commands.",
                            cmd: 'help'
                        }, {
                            des: "Get help documentation for exact match commands.",
                            cmd: 'help refresh'
                        }, {
                            des: "Get help documentation for fuzzy matching commands.",
                            cmd: 'help *e*'
                        }, {
                            des: "Get help documentation for specified group, match key must start with ':'.",
                            cmd: 'help :groupA'
                        }
                    ]
                }, {
                    key: 'clear',
                    title: 'Clear screen or history logs',
                    group: 'local',
                    usage: 'clear [history]',
                    description: 'Clear screen or history.',
                    example: [
                        {
                            cmd: 'clear',
                            des: 'Clear all records on the current screen.'
                        }, {
                            cmd: 'clear history',
                            des: 'Clear command history'
                        }
                    ]
                }, {
                    key: 'open',
                    title: 'Open page',
                    group: 'local',
                    usage: 'open <url>',
                    description: 'Open a specified page.',
                    example: [{
                        cmd: 'open blog.beifengtz.com'
                    }]
                }
            ],
            fullscreen: false,
            perfWarningRate: {
                count: 0
            },
            inputBoxParam: {
                boxWidth: 0,
                boxHeight: 0,
                promptWidth: 0,
                promptHeight: 0
            },
            flash: {
                open: false,
                content: null
            },
            ask: {
                open: false,
                question: null,
                isPassword: false,
                callback: null,
                autoReview: false,
                input: ''
            },
            textEditor: {
                open: false,
                focus: false,
                value: '',
                onClose: null,
                onFocus: () => {
                    this.textEditor.focus = true
                },
                onBlur: () => {
                    this.textEditor.focus = false
                }
            }
        }
    },
    props: {
        name: {
            type: String, default: 'terminal'
        },
        //  终端标题
        title: {
            type: String, default: 'vue-web-terminal'
        },
        //  初始化日志内容
        initLog: {
            type: Array, default: () => {
                return [{
                    type: 'normal',
                    content: "Terminal Initializing ..."
                }, {
                    type: 'normal',
                    content: "Current login time: " + new Date().toLocaleString()
                }, {
                    type: 'normal',
                    content: "Welcome to vue web terminal! If you are using for the first time, you can use the <span class='t-cmd-key'>help</span> command to learn.Thanks for your star support: <a class='t-a' target='_blank' href='https://github.com/tzfun/vue-web-terminal'>https://github.com/tzfun/vue-web-terminal</a>"
                }]
            }
        },
        //  上下文
        context: {
            type: String,
            default: '/vue-web-terminal'
        },
        //  命令行搜索以及help指令用
        commandStore: {
            type: Array
        },
        //   命令行排序方式
        commandStoreSort: {
            type: Function
        },
        //  记录条数超出此限制会发出警告
        warnLogCountLimit: {
            type: Number, default: 200
        },
        //  自动搜索帮助
        autoHelp: {
            type: Boolean,
            default: true
        },
        //  显示终端头部
        showHeader: {
            type: Boolean,
            default: true
        },
        //  是否开启命令提示
        enableExampleHint: {
            type: Boolean,
            default: true
        },
        //  输入过滤器
        inputFilter: {
            type: Function
        },
        //  拖拽配置
        dragConf: {
            type: Object,
            default: () => {
                return {
                    width: 700,
                    height: 500,
                    zIndex: 100,
                    init: {
                        x: null,
                        y: null
                    }
                }
            }
        },
        //  命令格式化显示函数
        commandFormatter: {
            type: Function
        },
        //  按下Tab键处理函数
        tabKeyHandler: {
            type: Function
        }
    },
    created() {
        TerminalObj.register(this.name, (type, options) => {
            if (type === 'pushMessage') {
                this._pushMessage(options)
            } else if (type === 'fullscreen') {
                this._fullscreen()
            } else if (type === 'isFullscreen') {
                return this.fullscreen
            } else if (type === 'dragging') {
                if (this._draggable()) {
                    this._dragging(options.x, options.y)
                } else {
                    console.warn("Terminal is not draggable")
                }
            } else if (type === 'execute') {
                if (!this.ask.open && !this.flash.open && _nonEmpty(options)) {
                    this.command = options
                    this._execute()
                }
            } else if (type === 'focus') {
                this._focus()
            } else if (type === 'elementInfo') {
                let windowEle = this.$refs.terminalWindow
                let windowRect = windowEle.getBoundingClientRect()
                let containerRect = this.$refs.terminalContainer.getBoundingClientRect()
                let hasScroll = windowEle.scrollHeight > windowEle.clientHeight || windowEle.offsetHeight > windowEle.clientHeight
                return {
                    pos: this._getPosition(),           //  窗口所在位置
                    screenWidth: containerRect.width,   //  窗口整体宽度
                    screenHeight: containerRect.height, //  窗口整体高度
                    clientWidth: hasScroll ? (windowRect.width - 48) : (windowRect.width - 40), //  可显示内容范围高度，减去padding值，如果有滚动条去掉滚动条宽度
                    clientHeight: windowRect.height,    //  可显示内容范围高度
                    charWidth: {
                        en: this.byteLen.en,            //  单个英文字符宽度
                        cn: this.byteLen.cn             //  单个中文字符宽度
                    }
                }
            } else if (type === 'textEditorOpen') {
                let opt = options || {}
                this.textEditor.value = opt.content
                this.textEditor.open = true
                this.textEditor.onClose = opt.onClose
                this._focus()
            } else if (type === 'textEditorClose') {
                return this._textEditorClose()
            } else {
                console.error("Unsupported event type: " + type)
            }
        })
    },
    async mounted() {
        this.$emit('initBefore', this.name)

        if (this.initLog != null) {
            await this._pushMessageBatch(this.initLog, true)
        }

        if (this.commandStore != null) {
            if (this.commandStoreSort != null) {
                this.commandStore.sort(this.commandStoreSort)
            }
            this.allCommandStore = this.allCommandStore.concat(this.commandStore)
        }

        this.byteLen = {
            en: this.$refs.terminalEnFlag.getBoundingClientRect().width / 2,
            cn: this.$refs.terminalCnFlag.getBoundingClientRect().width / 2
        }
        this.cursorConf.defaultWidth = this.byteLen.en

        let el = this.$refs.terminalWindow
        el.scrollTop = el.offsetHeight;

        let promptRect = this.$refs.terminalInputPrompt.getBoundingClientRect()
        this.inputBoxParam.promptWidth = promptRect.width
        this.inputBoxParam.promptHeight = promptRect.height


        this.keydownListener = event => {
            if (this._isActive()) {
                if (this.cursorConf.show) {
                    if (event.key.toLowerCase() === 'tab') {
                        if (this.tabKeyHandler == null) {
                            this._fillCmd()
                        } else {
                            this.tabKeyHandler(event)
                        }
                        event.preventDefault()
                    } else if (document.activeElement !== this.$refs.cmdInput) {
                        this.$refs.cmdInput.focus()
                    }
                }

                this.$emit('onKeydown', event, this.name)
            }
        }
        window.addEventListener('keydown', this.keydownListener);
        let safariStyleCache = {};
        //  监听全屏事件，用户ESC退出时需要设置全屏状态
        ['fullscreenchange', 'webkitfullscreenchange', 'mozfullscreenchange'].forEach((item) => {
            window.addEventListener(item, () => {
                let isFullScreen = document.fullScreen || document.mozFullScreen || document.webkitIsFullScreen || document.fullscreenElement;
                if (isFullScreen) {
                    //  进入全屏
                    if (_isSafari()) {
                        let container = this.$refs.terminalContainer
                        safariStyleCache = {
                            position: container.style.position,
                            width: container.style.width,
                            height: container.style.height,
                            left: container.style.left,
                            top: container.style.top
                        }
                        container.style.position = 'fixed'
                        container.style.width = '100%'
                        container.style.height = '100%'
                        container.style.left = '0'
                        container.style.top = '0'
                    }
                } else {
                    //  退出全屏
                    this.fullscreen = false
                    if (_isSafari()) {
                        let container = this.$refs.terminalContainer
                        container.style.position = safariStyleCache.position
                        container.style.width = safariStyleCache.width
                        container.style.height = safariStyleCache.height
                        container.style.left = safariStyleCache.left
                        container.style.top = safariStyleCache.top
                    }
                }
            });
        })

        this._initDrag()
        this.$emit('initComplete', this.name)
    },
    destroyed() {
        this.$emit('destroyed', this.name)
        window.removeEventListener('keydown', this.keydownListener)
        TerminalObj.unregister(this.name)
    },
    watch: {
        terminalLog() {
            this._jumpToBottom()
        },
        context: {
            handler() {
                this.$nextTick(() => {
                    this.inputBoxParam.promptWidth = this.$refs.terminalInputPrompt.getBoundingClientRect().width
                })
            }
        }
    },
    methods: {
        _triggerClick(key) {
            if (key === 'fullScreen' && !this.fullscreen) {
                this._fullscreen()
            } else if (key === 'minScreen' && this.fullscreen) {
                this._fullscreen()
            }
            this.$emit('onClick', key, this.name)
        },
        _resetSearchKey() {
            this.searchCmd.item = null
        },
        _searchCmd(key) {
            if (!this.autoHelp) {
                return;
            }
            let cmd = key
            if (cmd == null) {
                cmd = this.command.split(' ')[0]
            }
            if (_isEmpty(cmd)) {
                this._resetSearchKey()
            } else if (cmd.trim().indexOf(" ") < 0) {
                let reg = new RegExp(cmd, 'i')
                let matchSet = []

                let target = null
                for (let i in this.allCommandStore) {
                    let o = this.allCommandStore[i]
                    if (_nonEmpty(o.key)) {
                        let res = o.key.match(reg)
                        if (res != null) {
                            let score = res.index * 1000 + (cmd.length - res[0].length) + (o.key.length - res[0].length)
                            if (score === 0) {
                                //  完全匹配，直接返回
                                target = o
                                break
                            } else {
                                matchSet.push({
                                    item: o,
                                    score: score
                                })
                            }
                        }
                    }
                }
                if (target == null) {
                    if (matchSet.length > 0) {
                        matchSet.sort((a, b) => {
                            return a.score - b.score
                        })
                        target = matchSet[0].item
                    } else {
                        this.searchCmd.item = null
                        return
                    }
                }
                this.searchCmd.item = target
                this._jumpToBottom()
            }
        },
        _fillCmd() {
            if (this.searchCmd.item != null) {
                this.command = this.searchCmd.item.key
            }
        },
        _focus() {
            this.$nextTick(function () {
                if (this.ask.open) {
                    this.$refs.askInput.focus()
                } else if (this.textEditor.open) {
                    if (this.$refs.textEditor) {
                        this.$refs.textEditor.focus()
                    }
                } else {
                    //  没有被选中
                    if (this._getSelection().isCollapsed) {
                        this.$refs.cmdInput.focus()
                    } else {
                        this.cursorConf.show = true
                    }
                }
            })
        },
        _getSelection() {
            if (window.getSelection) {
                return window.getSelection()
            } else {
                return document.getSelection()
            }
        },
        /**
         * help命令执行后调用此方法
         *
         * 命令搜索：comm*、command
         * 分组搜索：:groupA
         */
        _printHelp(regExp, srcStr) {
            let content = {
                head: ['KEY', 'GROUP', 'DETAIL'],
                rows: []
            }
            let findGroup = srcStr && srcStr.length > 1 && srcStr.startsWith(":")
                ? srcStr.substring(1).toLowerCase()
                : null
            this.allCommandStore.forEach(command => {
                if (findGroup) {
                    if (_isEmpty(command.group) || findGroup !== command.group.toLowerCase()) {
                        return;
                    }
                } else if (!regExp.test(command.key)) {
                    return
                }
                let row = []
                row.push(`<span class='t-cmd-key'>${command.key}</span>`)
                row.push(command.group)

                let detail = ''
                if (_nonEmpty(command.description)) {
                    detail += `Description: ${command.description}<br>`
                }
                if (_nonEmpty(command.usage)) {
                    detail += `Usage: <code>${_unHtml(command.usage)}</code><br>`
                }
                if (command.example != null) {
                    if (command.example.length > 0) {
                        detail += '<br>'
                    }

                    for (let idx in command.example) {
                        let eg = command.example[idx]
                        detail += `
                        <div>
                            <div style="float:left;width: 30px;display:flex;font-size: 12px;line-height: 18px;">
                              eg${parseInt(idx) + 1}:
                            </div>
                            <div class="t-cmd-help-example">
                              <ul class="t-example-ul">
                                <li class="t-example-li"><code>${eg.cmd}</code></li>
                                <li class="t-example-li"><span></span></li>
                        `

                        if (_nonEmpty(eg.des)) {
                            detail += `<li class="t-example-li"><span>${eg.des}</span></li>`
                        }
                        detail += `
                            </ul>
                        </div>
                    </div>
                    `
                    }
                }

                row.push(detail)

                content.rows.push(row)
            })
            this._pushMessage({
                type: 'table',
                content: content
            })
        },
        _execute() {
            this._resetSearchKey()
            this._saveCurCommand();
            if (_nonEmpty(this.command)) {
                try {
                    let split = this.command.split(" ")
                    let cmdKey = split[0];
                    this.$emit("beforeExecCmd", cmdKey, this.command, this.name)
                    switch (cmdKey) {
                        case 'help': {
                            let reg = `^${split.length > 1 && _nonEmpty(split[1]) ? split[1] : "*"}$`
                            reg = reg.replace(/\*/g, ".*")
                            this._printHelp(new RegExp(reg, "i"), split[1])
                            break;
                        }
                        case 'clear':
                            this._doClear(split);
                            break;
                        case 'open':
                            this._openUrl(split[1]);
                            break;
                        default: {
                            this.showInputLine = false
                            let success = (message) => {
                                let finish = () => {
                                    this.showInputLine = true
                                    this._endExecCallBack()
                                }
                                if (message != null) {
                                    //  实时回显处理
                                    if (message instanceof TerminalFlash) {
                                        message.onFlush(msg => {
                                            this.flash.content = msg
                                        })
                                        message.onFinish(() => {
                                            this.flash.open = false
                                            finish()
                                        })
                                        this.flash.open = true
                                        return
                                    } else if (message instanceof TerminalAsk) {

                                        message.onAsk((options) => {
                                            this.ask.input = ''
                                            this.ask.isPassword = options.isPassword
                                            this.ask.question = _html(options.question)
                                            this.ask.callback = options.callback
                                            this.ask.autoReview = options.autoReview
                                            this._focus()
                                        })

                                        message.onFinish(() => {
                                            this.ask.open = false
                                            finish()
                                        })
                                        this.ask.open = true
                                        return
                                    } else {
                                        this._pushMessage(message)
                                    }
                                }
                                finish()
                            }

                            let failed = (message = 'Failed to execute.') => {
                                if (message != null) {
                                    this._pushMessage({
                                        type: 'normal', class: 'error', content: message
                                    })
                                }
                                this.showInputLine = true
                                this._endExecCallBack()
                            }

                            this.$emit("execCmd", cmdKey, this.command, success, failed, this.name)
                            return
                        }
                    }
                } catch (e) {
                    console.error(e)
                    this._pushMessage({
                        type: 'normal',
                        class: 'error',
                        content: _html(_unHtml(e.stack)),
                        tag: 'error'
                    })
                }
            }
            this._focus()
            this._endExecCallBack()
        },
        _endExecCallBack() {
            this.command = ""
            this._resetCursorPos()
            this.cursorConf.show = true
            this._focus()
        },
        _parseToJson(obj) {
            if (typeof obj === 'object' && obj) {
                return obj;
            } else if (typeof obj === 'string') {
                try {
                    return JSON.parse(obj);
                } catch (e) {
                    return obj;
                }
            }
        },
        _filterMessageType(message) {
            let valid = message.type && /^(normal|html|code|table|json)$/.test(message.type)
            if (!valid) {
                console.debug(`Invalid terminal message type: ${message.type}, the default type normal will be used`)
                message.type = 'normal'
            }
            return valid
        },
        /**
         * message内容：
         *
         * class: 类别，只可选：success、error、system、info、warning
         * type: 类型，只可选：normal、json、code、table、cmdLine、splitLine
         * content: 具体内容，不同消息内容格式不一样
         * tag: 标签，仅类型为normal有效
         *
         * 当 type 为 table 时 content 的格式：
         * {
         *     head: [headName1, headName2, headName3...],
         *     rows: [
         *         [ value1, value2, value3... ],
         *         [ value1, value2, value3... ]
         *     ]
         * }
         *
         * @param message
         * @param ignoreCheck
         * @private
         */
        _pushMessage(message, ignoreCheck = false) {
            if (message == null) return
            if (message instanceof Array) return this._pushMessageBatch(message, ignoreCheck)

            this._filterMessageType(message)

            this.terminalLog.push(message);
            if (!ignoreCheck) {
                this._checkTerminalLog()
            }
            if (message.type === 'json') {
                setTimeout(() => {
                    this._jumpToBottom()
                }, 80)
            }
        },
        async _pushMessageBatch(messages, ignoreCheck = false) {
            for (let m of messages) {
                this._filterMessageType(m)
                this.terminalLog.push(m);
            }
            if (!ignoreCheck) {
                this._checkTerminalLog()
            }
        },
        _jumpToBottom() {
            this.$nextTick(() => {
                let box = this.$refs.terminalWindow
                if (box != null) {
                    box.scrollTo({top: box.scrollHeight, behavior: 'smooth'})
                }
            })
        },
        _checkTerminalLog() {
            let count = this.terminalLog.length
            if (this.warnLogCountLimit > 0
                && count > this.warnLogCountLimit
                && Math.floor(count / this.warnLogCountLimit) !== this.perfWarningRate.count) {
                this.perfWarningRate.count = Math.floor(count / this.warnLogCountLimit)
                this._pushMessage({
                    content: `Terminal log count exceeded <strong style="color: red">${count}/${this.warnLogCountLimit}</strong>. If the log content is too large, it may affect the performance of the browser. It is recommended to execute the "clear" command to clear it.`,
                    class: 'system',
                    type: 'normal'
                }, true)
            }
        },
        _saveCurCommand() {
            if (_nonEmpty(this.command)) {
                historyStore.pushCmd(this.name, this.command)
            }
            this.terminalLog.push({
                type: "cmdLine",
                content: `${this.context} > ${this._commandFormatter(this.command)}`
            });
        },
        _doClear(args) {
            if (args.length === 1) {
                this.terminalLog = [];
            } else if (args.length === 2 && args[1] === 'history') {
                historyStore.clearLog(this.name)
            }
            this.perfWarningRate.size = 0
            this.perfWarningRate.count = 0
        },
        _openUrl(url) {
            let match = /^((http|https):\/\/)?(([A-Za-z0-9]+-[A-Za-z0-9]+|[A-Za-z0-9]+)\.)+([A-Za-z]+)[/?:]?.*$/;
            if (match.test(url)) {
                if (!url.startsWith("http") && !url.startsWith("https")) {
                    window.open(`http://${url}`)
                } else {
                    window.open(url);
                }
            } else {
                this._pushMessage({
                    class: 'error', type: 'normal', content: "Invalid website url"
                })
            }
        },
        _resetCursorPos(cmd) {
            this.cursorConf.idx = (cmd == null ? this.command : cmd).length
            this.cursorConf.left = 'unset'
            this.cursorConf.top = 'unset'
            this.cursorConf.width = this.cursorConf.defaultWidth
        },
        _calculateCursorPos(cmd) {
            //  idx可以认为是需要光标覆盖字符的索引
            let idx = this.cursorConf.idx
            let command = cmd == null ? this.command : cmd

            if (idx < 0 || idx >= command.length) {
                this._resetCursorPos()
                return
            }

            let lineWidth = this.$refs.terminalInputBox.getBoundingClientRect().width

            let pos = {left: 0, top: 0}
            //  当前字符长度
            let charWidth = this.cursorConf.defaultWidth
            //  前一个字符的长度
            let preWidth = this.inputBoxParam.promptWidth

            //  先找到被覆盖字符的位置
            for (let i = 0; i <= idx; i++) {
                charWidth = this._calculateStringWidth(command[i])
                pos.left += preWidth
                preWidth = charWidth
                if (pos.left > lineWidth) {
                    //  行高是20px
                    pos.top += 20
                    pos.left = charWidth
                }
            }

            this.cursorConf.left = pos.left + 'px'
            this.cursorConf.top = pos.top + 'px'
            this.cursorConf.width = charWidth
        },
        _cursorGoLeft() {
            if (this.cursorConf.idx > 0) {
                this.cursorConf.idx--;
            }
            this._calculateCursorPos()
        },
        _cursorGoRight() {
            if (this.cursorConf.idx < this.command.length) {
                this.cursorConf.idx++;
            }
            this._calculateCursorPos()
        },
        _switchPreCmd() {
            let cmdLog = historyStore.getLog(this.name)
            let cmdIdx = historyStore.getIdx(this.name)
            if (cmdLog.length !== 0 && cmdIdx > 0) {
                cmdIdx -= 1;
                this.command = cmdLog[cmdIdx] == null ? [] : cmdLog[cmdIdx];
            }
            this._resetCursorPos()
            historyStore.setIdx(this.name, cmdIdx)
            this._searchCmd(this.command.trim().split(" ")[0])
        },
        _switchNextCmd() {
            let cmdLog = historyStore.getLog(this.name)
            let cmdIdx = historyStore.getIdx(this.name)
            if (cmdLog.length !== 0 && cmdIdx < cmdLog.length - 1) {
                cmdIdx += 1;
                this.command = cmdLog[cmdIdx] == null ? [] : cmdLog[cmdIdx];
            } else {
                cmdIdx = cmdLog.length;
                this.command = '';
            }
            this._resetCursorPos()
            historyStore.setIdx(this.name, cmdIdx)
            this._searchCmd(this.command.trim().split(" ")[0])
        },
        _calculateStringWidth(str) {
            let width = 0
            for (let char of str) {
                width += (_getByteLen(char) === 1 ? this.byteLen.en : this.byteLen.cn)
            }
            return width
        },
        _onInput(e) {
            if (this.inputFilter != null) {
                let value = e.target.value
                let newStr = this.inputFilter(e.data, value, e)
                if (newStr == null) {
                    newStr = value
                }
                this.command = newStr
            }

            if (_isEmpty(this.command)) {
                this._resetSearchKey();
            } else {
                this._searchCmd()
            }

            this.$nextTick(() => {
                this._checkInputCursor()
                this._calculateCursorPos()
            })
        },
        _checkInputCursor() {
            let eIn = this.$refs['cmdInput']
            if (eIn.selectionStart !== this.cursorConf.idx) {
                this.cursorConf.idx = eIn.selectionStart
            }
        },
        _onInputKeydown(e) {
            let key = e.key.toLowerCase()
            if (key === 'arrowleft') {
                this._checkInputCursor()
                this._cursorGoLeft()
            } else if (key === 'arrowright') {
                this._checkInputCursor()
                this._cursorGoRight()
            }
        },
        _onInputKeyup(e) {
            let key = e.key.toLowerCase()
            let code = e.code.toLowerCase()
            if (key === 'home' || key === 'end' || code === 'altleft' || code === 'metaleft' || code === 'controlleft'
                || ((e.ctrlKey || e.metaKey || e.altKey) && (key === 'arrowright' || key === 'arrowleft'))) {
                this._checkInputCursor()
                this._calculateCursorPos()
            }
        },
        _fullscreen() {
            let fullArea = this.$refs.terminalContainer
            if (this.fullscreen) {
                if (document.exitFullscreen) {
                    document.exitFullscreen();
                } else if (document.webkitCancelFullScreen) {
                    document.webkitCancelFullScreen();
                } else if (document.mozCancelFullScreen) {
                    document.mozCancelFullScreen();
                } else if (document.msExitFullscreen) {
                    document.msExitFullscreen();
                }
            } else {
                if (fullArea.requestFullscreen) {
                    fullArea.requestFullscreen();
                } else if (fullArea.webkitRequestFullScreen) {
                    fullArea.webkitRequestFullScreen();
                } else if (fullArea.mozRequestFullScreen) {
                    fullArea.mozRequestFullScreen();
                } else if (fullArea.msRequestFullscreen) {
                    // IE11
                    fullArea.msRequestFullscreen();
                }
            }
            this.fullscreen = !this.fullscreen
        },
        _draggable() {
            return this.showHeader && this.dragConf
        },
        _initDrag() {
            if (!this._draggable()) {
                return
            }
            // 记录当前鼠标位置
            let mouseOffsetX = 0;
            let mouseOffsetY = 0;

            let dragArea = this.$refs.terminalHeader
            let box = this.$refs.terminalContainer
            let window = this.$refs.terminalWindow

            let isDragging = false;

            dragArea.onmousedown = e1 => {
                if (this.fullscreen) {
                    return
                }
                let e = e1 || window.event;
                mouseOffsetX = e.clientX - box.offsetLeft;
                mouseOffsetY = e.clientY - box.offsetTop;

                isDragging = true
                window.style['user-select'] = 'none'
            }

            document.onmousemove = e2 => {
                if (isDragging) {
                    let e = e2 || window.event;
                    let moveX = e.clientX - mouseOffsetX;
                    let moveY = e.clientY - mouseOffsetY;
                    this._dragging(moveX, moveY)
                }
            }

            document.onmouseup = () => {
                isDragging = false
                window.style['user-select'] = 'unset'
            }
        },
        _dragging(x, y) {
            let clientWidth = document.body.clientWidth
            let clientHeight = document.body.clientHeight
            let box = this.$refs.terminalContainer

            if (x > clientWidth - box.clientWidth) {
                box.style.left = (clientWidth - box.clientWidth) + "px";
            } else {
                box.style.left = Math.max(0, x) + "px";
            }

            if (y > clientHeight - box.clientHeight) {
                box.style.top = (clientHeight - box.clientHeight) + "px";
            } else {
                box.style.top = Math.max(0, y) + "px";
            }
        },
        _getDragStyle() {
            let clientWidth = document.body.clientWidth
            let clientHeight = document.body.clientHeight

            let confWidth = this.dragConf.width
            let width = confWidth == null ? 700 : confWidth

            if (confWidth && typeof confWidth === 'string' && confWidth.endsWith("%")) {
                width = clientWidth * (parseInt(confWidth) / 100)
            }
            let confHeight = this.dragConf.height
            let height = confHeight == null ? 500 : confHeight
            if (confHeight && typeof confHeight === 'string' && confHeight.endsWith("%")) {
                height = clientHeight * (parseInt(confHeight) / 100)
            }

            let zIndex = this.dragConf.zIndex ? this.dragConf.zIndex : 100

            let initX, initY

            let initPos = this.dragConf.init
            if (initPos && initPos.x && initPos.y) {
                initX = initPos.x
                initY = initPos.y
            } else {
                initX = (clientWidth - width) / 2
                initY = (clientHeight - height) / 2
            }
            return `position:fixed;
            width:${width}px;
            height:${height}px;
            z-index: ${zIndex};
            left:${initX}px;
            top:${initY}px;
            border-radius:15px;
            `
        },
        _nonEmpty(obj) {
            return _nonEmpty(obj)
        },
        _commandFormatter(cmd) {
            if (this.commandFormatter != null) {
                return this.commandFormatter(cmd)
            }
            let split = cmd.split(" ")
            let formatted = ''
            for (let i = 0; i < split.length; i++) {
                let char = _html(split[i])
                if (i === 0) {
                    formatted += `<span class='t-cmd-key'>${char}</span>`
                } else if (char.startsWith("-")) {
                    formatted += `<span class="t-cmd-arg">${char}</span>`
                } else if (char.length > 0) {
                    formatted += `<span>${char}</span>`
                }
                if (i < split.length - 1) {
                    formatted += "<span>&nbsp;</span>"
                }
            }
            return formatted
        },
        _getPosition() {
            if (this._draggable()) {
                let box = this.$refs.terminalContainer
                return {x: parseInt(box.style.left), y: parseInt(box.style.top)}
            } else {
                return {x: 0, y: 0}
            }
        },
        _onAskInput() {
            if (this.ask.autoReview) {
                this._pushMessage({
                    content: this.ask.question + (this.ask.isPassword ? '*'.repeat(this.ask.input.length) : this.ask.input)
                })
            }
            this.ask.question = null
            if (this.ask.callback) {
                this.ask.callback(this.ask.input)
            }
        },
        _textEditorClose() {
            if (this.textEditor.open) {
                this.textEditor.open = false
                let content = this.textEditor.value
                this.textEditor.value = ''
                if (this.textEditor.onClose) {
                    this.textEditor.onClose(content)
                }
                this.textEditor.onClose = null
                this._focus()
                return content
            }
        },
        /**
         * 判断当前terminal是否活跃
         * @returns {boolean}
         * @private
         */
        _isActive() {
            return this.cursorConf.show
                || (this.ask.open && this.$refs.askInput === document.activeElement)
                || (this.textEditor.open && this.textEditor.focus)
        }
    }
}
