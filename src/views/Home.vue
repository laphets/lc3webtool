<template>
  <div class="home">
    <div class="control-container">
      <button @click="compile">Compile!</button>
      <button @click="action('next')">Next</button>
      <button @click="action('step')">Step</button>
      <button @click="action('continue')">Contine</button>
      <button @click="action('finish')">Finish</button>
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
      decorations: null,
      inputPromiseResolve: null,
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

    
  },
  mounted() {
    this.editor = this.$refs.editor.getEditor();
    this.decorations = this.editor.deltaDecorations([], [
    ]);
  },
  methods: {
    switchLine() {
      if (this.lineNum != 0) {
        this.decorations = this.editor.deltaDecorations([this.decorations[0]], [     
            {
                range: new monaco.Range(this.lineNum,1,this.lineNum,1),
                options: {
                    isWholeLine: true,
                    className: 'myContentClass',
                    glyphMarginClassName: 'myGlyphMarginClass'
                }
            }
        ]);
      } else {
        this.decorations = this.editor.deltaDecorations([this.decorations[0]], []);
      }
      
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
      this.lc3simoutput = "";
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
        printErr: (text) => { this.lc3simoutput += text + "\n"; this.updateScroll();}
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
        alert(`lc3as error, code = ${lc3asResult.ret}`)
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
  overflow: scroll;
}
}

.myGlyphMarginClass {
  background: red;
  border-radius: 50%;
  display: inline-block;
}
.myContentClass {
	background: lightblue;
}


</style>