import TerminalCallback from "@/components/terminal/TerminalCallback";

class TerminalAsk extends TerminalCallback {
    ask(options) {
        if (this.handler != null) {
            this.handler(options)
        }
    }

    onAsk(callback) {
        this.handler = callback
    }
}

export default TerminalAsk
