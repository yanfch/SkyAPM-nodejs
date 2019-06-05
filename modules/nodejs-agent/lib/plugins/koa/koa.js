/*
 * Licensed to the SkyAPM under one or more
 * contributor license agreements.  See the NOTICE file distributed with
 * this work for additional information regarding copyright ownership.
 * The ASF licenses this file to You under the Apache License, Version 2.0
 * (the "License"); you may not use this file except in compliance with
 * the License.  You may obtain a copy of the License at
 *
 *      http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

"use strict";

const activeContext = require("../constants").ACTIVE_CONTEXT;
const layerDefine = require("../../trace/span-layer");
const componentDefine = require("../../trace/component-define");
const Tags = require("../../trace/tags");

module.exports = function(applicationModule, instrumentation, contextManager) {
    instrumentation.enhanceMethod(applicationModule.prototype, "createContext", wrapCreateContext);
    instrumentation.enhanceMethod(applicationModule.prototype, "respond", wrapRespond);

    /**
     *
     * @param {origin} origin
     * @return {Function}
     */
    function wrapCreateContext(origin) {
        return function(req, res) {
            let ctx = origin.apply(this, arguments);
            ctx[activeContext] = contextManager.activeTraceContext();
            return ctx;
        };
    }
    /**
     * @param {origin} origin
     * @return {Function}
     */
    function wrapRespond(origin) {
        return function(ctx) {
            let runningSpan = ctx[activeContext].span();
            try {
                let requestURL = ctx.routerPath || ctx.url;
                contextManager.rewriteEntrySpanInfo(runningSpan, {
                    "operationName": requestURL,
                    "component": componentDefine.Components.KOA,
                    "spanLayer": layerDefine.Layers.HTTP,
                });
                Tags.URL.tag(runningSpan, ctx.url);
                Tags.HTTP_METHOD.tag(runningSpan, ctx.method);
            } catch (e) {
                runningSpan.errorOccurred();
                runningSpan.log(e);
            }
            return origin.apply(this, arguments);
        };
    }

    return applicationModule;
};
