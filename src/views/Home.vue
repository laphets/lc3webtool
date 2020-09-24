<template>
  <div class="home">
    <pre>
      LC3 Webtool Guides:
      Write your LC3 code in below editor, click "Compile" to run lc3as and lc3sim for your code(two steps in one click).
      If compile successfully, you should see a lightblue line indicating your current execution position. You can click on line number area to add/remove breakpoints.
      You can also click Next/Step/Continue/Finish to control lc3sim debug execution flow, which should be quite similar with lc3sim-tk.
      Just click "Compile" again if you want to rerun your code.
    </pre>
    <div class="control-container">
      <button @click="compile">Compile!</button>
      <button @click="action('next')">Next</button>
      <button @click="action('step')">Step</button>
      <button @click="action('continue')">Continue</button>
      <button @click="action('finish')">Finish</button>
    </div>
    <div class="register-container">
      <div class="register-block" v-for="(reg, index) in regArray">
        {{regName[index]}} <input :value="num2hex(reg)">
      </div>
    </div>
    
    <div class="editor-container">
      <MonacoEditor class="editor" ref="editor" v-model="code" :options="options" language="javascript" />
      <pre class="output" id="output">
        {{lc3simoutput}}
      </pre>
    </div>
    
  </div>
</template>

<script>
// @ is an alias to /src
import MonacoEditor from 'vue-monaco'
import * as wasm from '@/wasm/wasm'

export default {
  name: 'Home',
  components: {
    MonacoEditor
  },
  data() {
    return {
      editor: null,
      outputKey: 0,
      lc3asModule: null,
      lc3simModule: null,
      lc3simoutput: "",
      nextInput: "",
      lineNum: 0,
      decorations: [],
      decorationStr: [],
      inputPromiseResolve: null,
      debugMap: {},
      regArray: [],
      breakPoints: {},  // line -> breakpoint
      regName: ["R0", "R1", "R2", "R3", "R4", "R5", "R6", "R7", "PC", "IR", "PSR"],
      options: {
        glyphMargin: true
      },
      code: `.ORIG x3000
AND R1,R1,#0
ADD R1,R1,#12

JSR SUBROUTINE

AND R3,R3,#0

HALT


SUBROUTINE
AND R2,R2,#0
ADD R2,R2,#1
ret


.END`
    }
  },
  created() {
    console.log(wasm)
    global.getInput = async(buffer) => {
      // console.log(buffer);
      this.inputPromise = new Promise((resolve, reject) => {
        this.inputPromiseResolve = resolve;
      });
      const command = await this.inputPromise;
      console.log("we got a promise command", command)
      // const command = prompt("Please input some command");
      const input = wasm.toUTF8StrArray(command);
      this.lc3simModule.HEAPU8.set(input, buffer); // write WASM memory calling the set method of the Uint8Array
    }
    global.setLineNum = (lineNum) => {
      this.lineNum = lineNum;
      this.switchLine();
    }
    global.setRegisters = (lc3Register) => {
      console.log(lc3Register)
      const regArray = new Int32Array(this.lc3simModule.HEAP32.buffer, lc3Register, 11);
      this.regArray = Array.from(regArray);
      console.log(this.regArray)
    }
    global.setDebugInfo = (lc3Debug) => {
      this.debugMap = {};
      const debugArray = new Int32Array(this.lc3simModule.HEAP32.buffer, lc3Debug, 65536);
      for(let i = 0; i < debugArray.length; i++) {
        if(debugArray[i] != 0) {
          this.debugMap[debugArray[i]] = i;
        }
      }
      console.log(this.debugMap)
    }

    
  },
  mounted() {
    this.editor = this.$refs.editor.getEditor();
    global.editor = this.editor;
    this.decorations = [];
    this.editor.onMouseDown((event) => {
      if(event.target.type != 3 && event.target.type != 2)
        return;
      const lineNumber = event.target.position.lineNumber;
      if(this.breakPoints[lineNumber]) {
        // remove breakpoint
        // console.log("remove", lineNumber);
        this.breakPoints[lineNumber] = false;
        this.decorations = this.decorations.filter((item) => {
          return item.type == "breakpoint" && item.lineNumber != lineNumber;
        });
        this.inputPromiseResolve(`break clear #${this.debugMap[lineNumber]}`)
      } else {
        // add breakpoint
        if(this.debugMap[lineNumber] == undefined)
          return;
        this.breakPoints[lineNumber] = true;
        this.decorations.push({
          lineNumber,
          range: new monaco.Range(lineNumber,1,lineNumber,1),
          type: "breakpoint",
          options: {
              isWholeLine: true,
              glyphMarginClassName: 'breakpoint'
          }
        });
        this.inputPromiseResolve(`break set #${this.debugMap[lineNumber]}`)
        
      }
      this.updateDecoration();
    })
  },
  methods: {
    updateDecoration() {
      // console.log(this.decorations)
      this.decorationStr = this.editor.deltaDecorations(this.decorationStr, this.decorations);
    },
    clearBreakpoint() {
      this.debugMap = {};
      this.breakPoints = {};
      this.decorations = [];
      this.decorationStr = this.editor.deltaDecorations(this.decorationStr, []);
    },  
    addBreakPoint() {

    },
    num2hex(num) {
      return num.toString(16);
    },
    switchLine() {
      if (this.lineNum != 0) {
        const lineNumber = this.lineNum;
        this.decorations = this.decorations.filter((item) => {
          return item.type != "hit";
        });
        this.decorations.push({
          lineNumber,
          range: new monaco.Range(lineNumber,1,lineNumber,1),
          type: "hit",
          options: {
              isWholeLine: true,
              className: 'myContentClass',
          }
        })
        this.updateDecoration();
      } else {
        this.decorations = this.decorations.filter((item) => {
          return item.type != "hit";
        });
        this.updateDecoration();
      }
      this.editor.revealLineInCenter(this.lineNum);
      
    },
    action(name) {
      console.log(name);
      this.inputPromiseResolve(name)
    },
    updateScroll() {
      this.$nextTick(() => {
        const container = this.$el.querySelector("#output");
        container.scrollTop = container.scrollHeight;
      });
    },
    async compile() {
      console.log("compile")
      this.clearBreakpoint();
      this.lc3simoutput = "";
      this.editor.revealLineInCenter(1);
      let lc3aserror = "";
      this.lc3asModule = await createLC3asModule({
        postRun: [function () {
            console.log(`Loaded lc3asModule Module OK`);
        }],
        preRun: [],
        print: (text) => { 
          this.lc3simoutput += (text + "\n");
          this.updateScroll();

          // this.$nextTick(() => {
          //     this.lc3simoutput += (text + "\n");
          //     console.log('re-render start')
          //     this.$nextTick(() => {
          //         console.log('re-render end')
          //     })
          // })
          
          // outputKey++;
          // this.$forceUpdate();
          // console.log(this.lc3simoutput);
        },
        printErr: (text) => { lc3aserror += text + "\n"; this.lc3simoutput += text + "\n"; this.updateScroll();}
      });
      this.lc3simModule = await createLC3simModule({
        postRun: [function () {
            console.log(`Loaded lc3simModule Module OK`);
        }],
        preRun: [],
        print: (text) => { this.lc3simoutput += text + "\n"; this.updateScroll(); },
        printErr: (text) => { this.lc3simoutput += text + "\n"; this.updateScroll(); }
      });

      
      const lc3asResult = wasm.runlc3as(this.lc3asModule, this.code);
      console.log(wasm.uint8arrayToString(lc3asResult.debug))
      if(lc3asResult.ret != 0) {
        alert(`lc3as compile error ${lc3aserror}`)
        return;
      }

      this.$forceUpdate();

      this.$nextTick(() => {
        this.$nextTick(() => {
          const lc3simResult = wasm.runlc3sim(this.lc3simModule, lc3asResult);
          console.log(lc3simResult)
        })
      })

      
    }
  }

}
</script>
<style lang="less">
.control-container {
  margin: 0px 0px 20px 0px;
  button {
    margin: 0px 5px;
  }
}
.home {
  margin: 20px;
}
.editor-container {
  
  display: flex;
  flex-direction: row;
.editor {
  width: 600px;
  height: 600px;
}
.output {
  height: 500px;
  width: 80%;
  overflow: scroll;
  margin-left: 20px;
}
}

.breakpoint {
  background: red;
  border-radius: 50%;
  display: inline-block;
  width: 14px !important;
  height: 14px !important;
}
.myContentClass {
	background: lightblue;
}

.register-container {
  margin: 0px 0px 16px 0px;
  display: flex;
  flex-direction: row;
  .register-block {
    margin: 0px 10px;
  }
  input {
    width: 30px;
  }
}


</style>