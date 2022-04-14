(function ($) {
  'use strict';
  const fields   = Object.values(cybozu.data.page.FORM_DATA.schema.table.fieldList);
  const fieldMap = fields.reduce((map, field) => ({ ...map, [field.var]: field }), {});

  kintone.events.on(['app.record.detail.show', 'app.record.create.show', 'app.record.edit.show'], async function (event) {
    const taxonomies = await axios_tc_mysql({
      init  : { name: 'tc2_digitown' },
      action: 'getRecords',
      table : 'dt1_wp_category_master',
    }).then(resp => {
      const taxonomy = {};
      resp.forEach(el => {
        if (el.taxonomy) {
          if (!taxonomy[el.taxonomy]) taxonomy[el.taxonomy] = [];
          taxonomy[el.taxonomy].push(el)
        }
      });
      return taxonomy;
    })


    for (const tax in taxonomies) {
      const space = kintone.app.record.getSpaceElement(tax);

      if (['app.record.create.show', 'app.record.edit.show'].includes(event.type)) {
        if (space) space.innerHTML = `<btn-show-modal taxonomy="${tax}"></btn-show-modal>`;
        /** **************************************************************************************************
         * Vue コンポーネント
         ************************************************************************************************** */

        Vue.component('btn-show-modal', {
          props: ['taxonomy'],
          data() {
            return {
              dialog  : false,
              terms   : [],
              selected: [],
              tree    : [],
              taxField: {},
            }
          },
          mounted: async function() {
            this.terms    = taxonomies[this.taxonomy];
            this.taxField = outputTaxField(this.taxonomy);
            this.tree     = this.get_taxonomy_hierarchy(this.taxonomy);

            if (fieldMap[this.taxField.fieldCode]) {

              // フィールド取得, スタイル変更
              const field = document.querySelector(`.value-${fieldMap[this.taxField.fieldCode].id}`);
              field.style.backgroundColor = '#eee';
              field.style.border          = '1px solid #d8d8d8';
              field.style.padding         = '4px 8px';
              field.style.wordWrap        = 'break-word';
              field.style.maxHeight       = '180px';
              field.style.overflowY       = 'auto';


              // 入力フィールドを隠す
              const input_outer = field.querySelector(`.input-text-outer-cybozu`);
              input_outer.style.display = 'none';

              // フィールドの値をselectedに格納
              const input     = field.querySelector('input');
              const termIds   = input.value.split(',');
              const termNames = [];
              termIds.forEach( termId => {
                const term = this.terms.find(v => v.term_id == termId);
                if (term) {
                  this.selected.push(term);
                  termNames.push(term.name);
                }
              });

              const termInput = document.createElement('div')
              termInput.classList.add('term_names');
              field.appendChild(termInput);
              termInput.innerHTML = termNames.join('<br>');

              // ref探す
              const searchRef = setInterval(_ => {
                if (this.$refs[this.taxonomy]) {
                  // 値をもとにチェックを入れる
                  this.$refs[this.taxonomy].setCheckedNodes(this.selected);
                  clearInterval(searchRef);
                }
              }, 100);
            }
          },
          methods: {
            get_taxonomy_hierarchy($taxonomy, $parent = 0) {
              console
              const terms = this.terms.filter(v => v.parent == $parent);
              const children = [];
              terms.forEach($term => {
                $term.label = $term.name;
                $term.children = this.get_taxonomy_hierarchy($taxonomy, $term.term_id);
                children.push($term);
              });
              return children;
            },
            selectTerm() {
              // フィールド取得
              const field = document.querySelector(`.value-${fieldMap[this.taxField.fieldCode].id}`);

              // 選択されたタームを取得
              const terms = this.$refs[this.taxonomy].getCheckedNodes();
              // console.log(terms)

              // 選択されたタームを格納
              this.selected = terms;

              // フィールド取得
              const input  = field.querySelector(`input`);
              const termInput = field.querySelector(`.term_names`);

              // 選択されたタームのタームIDだけを抜き出し
              const termIds   = [];
              const termNames = [];
              this.selected.forEach(term => {
                termIds.push(term.term_id);
                termNames.push(term.name);
              });

              // フィールドにカンマ区切りで入力
              input.value = termIds.join(',');
              // ターム名をリスト表示（再構築）
              termInput.innerHTML = termNames.join('<br>');
            },
          },
          template: `
          <div style="display:flex;flex-wrap:wrap;gap:10px;width:100%;">
            <template v-if="tree.length">
              <el-button
                @click="dialog = !dialog"
              >{{ taxField.label }}選択</el-button>
              <el-dialog
                width="30%"
                :title="taxField.label"
                :visible.sync="dialog"
              >
                <el-tree
                  show-checkbox
                  check-on-click-node
                  label="name"
                  node-key="term_id"
                  style="width:100%;overflow:auto;"
                  :ref="taxonomy"
                  :data="tree"
                  @check-change="selectTerm"
                ></el-tree>
                <span slot="footer" class="dialog-footer">
                  <el-button type="primary" @click="dialog = !dialog">閉じる</el-button>
                </span>
              </el-dialog>

            </template>
          </div>
          `
        });
      }


      /** **************************************************************************************************
       * Vue 本体
       ************************************************************************************************** */
      if (space) {
        new Vue({
          el: `#${space.id}`,
          data() {
            return {
              taxField: {},
            }
          },
          mounted: async function () {
            // console.clear()
            if (event.type == 'app.record.detail.show') {
              this.taxField = outputTaxField(tax);
              if (fieldMap[this.taxField.fieldCode]) {
                const field = document.querySelector(`.value-${fieldMap[this.taxField.fieldCode].id}`);
                const input = field.querySelector(`span`);
                field.style.maxHeight = '180px';
                field.style.overflowY = 'auto';

                const termIds = (input) ? input.innerText.split(',') : [];
                const termNames = [];

                termIds.forEach(termId => {
                  if (termId) {
                    const term = taxonomies[tax].find(v => v.term_id == termId);
                    termNames.push(term.name);
                  }
                })
                input.innerHTML = termNames.join('<br>');
              }
            }
          },
          methods: {
          }
        })
      }
    }

    return event;
  });

  kintone.events.on(['app.record.index.show', 'app.record.index.edit.show', 'app.record.edit.submit.success'], async function (event) {
    const taxonomies = await axios_tc_mysql({
      init: { name: 'tc2_digitown' },
      action: 'getRecords',
      table: 'dt1_wp_category_master',
    }).then(resp => {
      const taxonomy = {};
      resp.forEach(el => {
        if (el.taxonomy) {
          if (!taxonomy[el.taxonomy]) taxonomy[el.taxonomy] = [];
          taxonomy[el.taxonomy].push(el)
        }
      });
      return taxonomy;
    })

    for (const tax in taxonomies) {
      const taxField = fieldMap[outputTaxField(tax, 'fieldCode')];
      if(taxField) {
        const cells = document.getElementsByClassName(`value-${taxField.id}`);
        cells.forEach((cell, i) => {
          if (event.type == 'app.record.index.edit.show') {
            const input = cell.querySelector('input')
            if (input){
              const termIds = input.value.split(',');
              input.remove();
              console.log(termIds)

              const cellEl = document.createElement('div');
              cellEl.classList.add('line-cell-gaia');
              cell.appendChild(cellEl);
              cellEl.style.maxHeight = '100px';
              cellEl.style.overflow = 'auto';
              cellEl.style.padding = '14px 8px';

              const taxEl = document.createElement('span');
              cellEl.appendChild(taxEl);

              const termNames = [];
              termIds.forEach(termId => {
                if (termId) {
                  const term = taxonomies[tax].find(v => v.term_id == termId);
                  termNames.push(term.name);
                }
              });
              taxEl.innerHTML = termNames.join('<br>');
            }
          } else {
            const cellEl = cell.querySelector('.line-cell-gaia');
            cellEl.style.maxHeight = '100px';
            cellEl.style.overflow = 'auto';
            const taxEl = cell.querySelector('span');
            if (taxEl) {
              const termIds = taxEl.innerText.split(',');

              const termNames = [];
              termIds.forEach(termId => {
                if (termId) {
                  const term = taxonomies[tax].find(v => v.term_id == termId);
                  termNames.push(term.name);
                }
              });
              taxEl.innerHTML = termNames.join('<br>')
            }
          }
        })
      }
    }
    console.log(event)
    return event;
  });

  function outputTaxField(tax, key) {
    let obj;
    switch(tax) {
      case 'cat_job_offer_genre':             obj = { name: tax, label: '共通タグ',         fieldCode: '共通タグ' }; break;
      case 'cat_job_offer_genre_agriculture': obj = { name: tax, label: '農業タグ',         fieldCode: '業種別タグ_農業_' }; break;
      case 'cat_job_offer_genre_wedding':     obj = { name: tax, label: 'ウェディングタグ', fieldCode: '業種別タグ_ウェディング_' }; break;
      case 'cat_job_offer_genre_stay':        obj = { name: tax, label: '宿泊タグ',         fieldCode: '業種別タグ_宿泊_' }; break;
      case 'cat_enterprise_genre':            obj = { name: tax, label: '事業所ジャンル',   fieldCode: '' }; break;
      case 'cat_job_type':                    obj = { name: tax, label: '職種',             fieldCode: '職種' }; break;
      case 'cat_events':                      obj = { name: tax, label: 'イベント',         fieldCode: '' }; break;
    }
    return (key) ? obj[key] : obj;
  }

  /** ***************************************************************************
   * admin ajax
   *************************************************************************** */
  async function axios_tc_mysql(param) {
    const ajax_url = `https://timeconcier.jp/forline/tccom/v2/tcLibMySQL/`;
    return await axios({
      url: ajax_url,
      data: param,
      method: 'POST',
      headers: { 'Content-Type': (param) ? 'application/json' : 'multipart/form-data' },
      responseType: 'json',
    }).then(res => {
      if (res.status === 200) {
        return res.data;
      } else {
        throw res;
      }
    }).catch(err => {
      console.error(err);
    })
  }
})();
