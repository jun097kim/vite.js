import { ledger as _ledger, onroad } from 'const/method';
import { RPCresponse, RPCrequest, BuiltinTxType, Address } from "const/type";
import { checkParams } from 'utils/tools';
import { validReqAccountBlock } from 'utils/builtin';
import { isValidHexAddr } from 'utils/address/privToAddr';
import { getBuiltinTxType, signAccountBlock } from 'utils/accountBlock';
import client from '.';

export default class ledger {
    _client: client

    constructor(client) {
        this._client = client;
    }

    async getBalance(addr: Address) {
        let err = checkParams({ addr }, ['addr' ], [{
            name: 'addr',
            func: isValidHexAddr
        }]);
        if (err) {
            return Promise.reject(err);
        }

        const data = await this._client.batch([{
            methodName: _ledger.getAccountByAccAddr,
            params: [addr]
        }, {
            methodName: onroad.getAccountOnroadInfo,
            params: [addr]
        }]);

        if (!data || (data instanceof Array && data.length < 2)) {
            return null;
        }

        return {
            balance: data[0].result,
            onroad: data[1].result
        };
    }

    async getTxList({
        addr, index, pageCount = 50, totalNum = null
    }: {
        addr: Address, index: number, pageCount?: number, totalNum?: number
    }) {
        let err = checkParams({ addr, index }, ['addr', 'index'], [{
            name: 'addr',
            func: isValidHexAddr
        }]);
        if (err) {
            return Promise.reject(err);
        }

        index = index >= 0 ? index : 0; 

        if (totalNum === 0) {
            return {
                totalNum, list: []
            }
        }

        let requests: RPCrequest[] = [{
            methodName: _ledger.getBlocksByAccAddr,
            params: [addr, index, pageCount]
        }];
        if (!totalNum) {
            requests.push({
                methodName: _ledger.getAccountByAccAddr,
                params: [addr]
            })
        }

        const data = await this._client.batch(requests);

        let rawList;
        requests.forEach((_r, i) => {
            if (_r.methodName === _ledger.getAccountByAccAddr) {
                totalNum = data[i].result ? data[i].result.totalNumber : 0;
                return;
            }
            rawList = data[i].result || [];
        })

        let list: any[] = [];
        rawList.forEach((item: any) => {
            let txType = getBuiltinTxType(item.toAddress, item.data, +item.blockType);
            item.txType = BuiltinTxType[txType];
            list.push(item);
        });

        return { list, totalNum };
    }

    async sendRawTx(accountBlock, privateKey) {
        let err = checkParams({ accountBlock, privateKey }, ['accountBlock', 'privateKey'], [{
            name: 'accountBlock',
            func: (_a)=>{
                return !validReqAccountBlock(_a);
            }
        }]);
        if (err) {
            return Promise.reject(err);
        }

        let _accountBlock = signAccountBlock(accountBlock, privateKey);

        try {
            await this._client.tx.sendRawTx(_accountBlock);
            return accountBlock;
        } catch(err) {
            let _err = err;
            _err.accountBlock = accountBlock;
            return Promise.reject(_err);
        }
    }
}
