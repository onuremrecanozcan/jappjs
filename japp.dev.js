var japp = new (function jApp() {
	var that = this;
	var id_misc_model_map = {};
	this.beans = {};
	var allUsedKeys = {};
	var id_count = 0;
	var miscs = ['href', 'src', 'value', 'style', 'class'];
	var components = {};
	var coordinatedModels = {};
	var modelValCache = {};

	function addCooridnated(model1, model2) {
		coordinatedModels[model1] = model2;
	}
	this.component = function (tag, component) {
		components[tag] = component;
	}
	var componentCount = 0;
	function renderComponents($obj, bean) {
		var compObjs = $obj.find("comp");
		for (i = 0; i < compObjs.length; i++) {
			var cmpObj = compObjs[i];
			var tag = cmpObj.getAttribute("name");
			var component = components[tag];
			var scope, trackId = tag + componentCount;
			if (component.hasOwnBean) {//istersen kendi bean'i olmayan bir component'de yapabilirsin
				var modelAttr = cmpObj.getAttribute("model");
				scope = that.bean(trackId, component.bean);
				scope.isComponentBean = true;
				addUsedKey(scope.name, 'model');
				addUsedKey(bean.name, modelAttr);
				scope.model = getValFromKey(modelAttr, bean);
				addCooridnated(bean.name + '.' + modelAttr, scope.name + '.model');
			} else {
				scope = bean;
			}
			result = component.render($(cmpObj), scope, trackId);
			$(cmpObj).replaceWith(result);
			$replacedObj = $("#" + trackId);
			runForBean(scope.name, $replacedObj);
			if (component.hasOwnBean) {
				$replacedObj.attr("data-bean", scope.name);
			}
			componentCount++;
		}
	}
	var repCount = 0;
	var rep_model_id_map = {};
	var repHtmlCache = {};
	function renderRepeats($scopeObj, bean) {
		var rep_elems = $scopeObj.find("*[data-repeat]");
		rep_elems = Array.prototype.slice.call(rep_elems, 0);
		rep_elems.reverse();
		if (rep_elems != null) {
			$.each(rep_elems, function (idx, elem) {
				$elem = $(elem);
				if (elem.hasAttribute('data-rep-id')) return;
				$elem.attr('data-rep-id', repCount);
				repHtmlCache[repCount] = elem.outerHTML;
				repCount++;
			});
			$.each(rep_elems, function (idx, elem) {
				$elem = $(elem);
				if ($elem.attr('data-rep-i')) return;
				var modelN = $elem.attr('data-repeat');
				var varN = $elem.attr('data-var');
				var arr = getValFromKey(modelN, bean);
				if (arr == null || arr == undefined) { arr = []; }
				modelValCache[bean.name, modelN + '.length'] = arr.length;
				var repId = $elem.attr('data-rep-id');
				$elem.attr('data-rep-model', bean.name + '.' + modelN + '.length');
				addUsedKey(bean.name, modelN + '.length');
				modelN = that.replaceAll(modelN, "$model.", "");
				var html = '';
				if (arr.length != 0)
					$.each(arr, function (i, item) {
						$elem.attr('data-rep-i', i);
						$clone = $elem.clone();
						var innerHtml = $elem.html();
						innerHtml = that.replaceAll(innerHtml, '$' + varN, "japp.bean('" + bean.name + "')." + modelN + '[' + i + ']');
						$clone.html(that.replaceAll(innerHtml, varN, modelN + '[' + i + ']'));
						//console.log($clone.html());
						$.each(miscs, function (j, miscKey) {
							var value = $clone.attr('data-' + miscKey) || null;
							if (value != null) {
								value = that.replaceAll(value, varN, modelN + '[' + i + ']');
								$clone.attr('data-' + miscKey, normalizeKey(value));
							}
						});
						html += $clone[0].outerHTML;
					}); else {
					$elem.attr('data-rep-i', 0);
					$elem.css('display', 'none');
					html = elem.outerHTML;
				}
				$elem.replaceWith(html);
			});
		}
	}
	function updateRepeats(newData, modelN) {
		if(modelN.indexOf("'")!=-1) return;
		var	elems = $("*[data-rep-model='" + modelN + "']");
		var l = elems.length;
		if (l == 0) return;
		var beanN = modelN.split('.')[0];
		var closestParent = $(document.querySelector('*[data-bean="' + beanN + '"]')).find("*[data-repeat]").parent();
		for (i = 0; i < l; i++) {
			$elem = $(elems[i]);
			$.each($elem, function (i, elemObj) {
				$elemObj = $(elemObj);
				if ($elemObj.attr('data-rep-i') != '0') { $elemObj.remove(); }
			});
			var elemId = $elem.attr("data-rep-id");
			$elem.replaceWith(repHtmlCache[elemId]);
		}
		runForBean(beanN, closestParent);
	}
	function textNodesUnder(el) {
		var n, a = [], walk = document.createTreeWalker(el, NodeFilter.SHOW_TEXT, null, false);
		while (n = walk.nextNode()) a.push(n);
		return a;
	}
	function renderOuts($obj, bean) {
		var nodes = textNodesUnder($obj[0]);
		var regex = /{{\s*(.*?)\s*}}/g;
		for (i = 0; i < nodes.length; i++) {
			var html = nodes[i].nodeValue;
			while (m = regex.exec(html)) {
				var normalized_key = normalizeKey(m[1]);
				var value = getValFromKey(m[1], bean);
				addUsedKey(bean.name, normalized_key, value);
				addOutKey(bean.name + "." + normalized_key, "_" + id_count);
				html = japp.replaceAll(html, "{{" + m[1] + "}}", "<span id=\"_" + id_count + "\">" + value + "</span>");
				id_count++;
				$(nodes[i]).replaceWith(html);
			}
		}
	}
	function renderEvents($obj, bean) {
		var eventElems = $obj.find("*[data-event]");
		var l = eventElems.length;
		for (i = 0; i < l; i++) {
			var evData = eventElems[i].getAttribute('data-event').split(',');
			eventElems[i].setAttribute(evData[0], "japp.bean('" + bean.name + "')." + evData[1]);
		}
		l = null;
	}
	function getValFromKey(outKey, $model) {
		try {
			return eval(outKey + " || ''");
		} catch (ex) {
			return ex+"";
		}
	}
	function addUsedKey(bean, outKey, value) {
		if (outKey == undefined) return;
		if (that.beans[bean] == null) return;
		var list = allUsedKeys[bean] || [];
		if (list.indexOf(outKey) == -1)
			list.push(outKey);
		allUsedKeys[bean] = list;
		if (value == undefined) value = getValFromKey(outKey, that.beans[bean]);
		modelValCache[bean + '.' + outKey] = value;
	}
	var key_idlist_out = {};
	function addOutKey(outKey, id) {
		var list = key_idlist_out[outKey] || [];
		if (list.indexOf(id) == -1)
			list.push(id);
		key_idlist_out[outKey] = list;
	}
	var miscCount = 0;
	function renderMiscs($obj, bean) {
		$.each(miscs, function (i, misc) {
			var data_miscs = $obj.find("*[data-" + misc + "]"); //bu misc'i taÅŸÄ±yan dom nesnelerinin listesi
			$.each(data_miscs, function (j, miscObj) {
				if (miscObj.hasAttribute('data-m-ok')) return;
				if (miscObj.hasAttribute(misc)) return;
				var miscValue = $(miscObj).attr("data-" + misc); //miscValue aslÄ±nda outKey
				miscNormalizedValue = normalizeMiscKey(miscValue);
				if (miscValue != miscNormalizedValue) {
					$(miscObj).attr("data-" + misc, miscNormalizedValue);
					miscValue = miscNormalizedValue;
				}
				addUsedKey(bean.name, miscValue);
				var miscId = "jm_" + miscCount;
				miscCount++;
				$(miscObj).attr('data-id', miscId);
				var idList = id_misc_model_map[bean.name + '.' + miscValue] || [];
				idList.push({ id: miscId, data_misc: misc });
				id_misc_model_map[bean.name + '.' + miscValue] = idList;
				miscValue = getValFromKey(miscValue, bean);
				$(miscObj).attr(misc, miscValue);
				$(miscObj).attr('data-m-ok', 'ok');
			});
		});
	}

	this.renderAll = function ($scopeObj, bean) {
		renderRepeats($scopeObj, bean);
		renderComponents($scopeObj, bean);
		renderOuts($scopeObj, bean);
		renderMiscs($scopeObj, bean);
		renderEvents($scopeObj, bean);
	}
	var $context = new (function () {
		this.get = function (beanN) {
			return that.beans[beanN];
		}
		this.injectAll = function (bean, arr) {
			for (i = 0; i < arr.length; i++) {
				bean[arr[i]] = that.beans[arr[i]];
			}
		}
	});
	var isFirstRun = true;
	var runCompleted = false;
	this.run = function (objselector, callback) {
		runCompleted = false;
		if (isFirstRun) {
			//construct beans
			$.each(that.beans, function (name, bean) {
				if (bean.construct) bean.construct($context);
			});
		}
		var beanScopes = $(document.querySelector(objselector + " *[data-bean]"));// $obj.find("*[data-bean]");
		beanScopes = Array.prototype.slice.call(beanScopes, 0);
		beanScopes.reverse();
		$.each(beanScopes, function (i, scope) {
			var beanN = $(scope).attr('data-bean');
			runForBean(beanN, $(scope));
		});
		if (callback != null) {
			callback();
		}
		isFirstRun = false;
		runCompleted = true;
		heartBeat();
	}
	this.updateState = function () {
		heartBeat();
	}
	function runForBean(beanN, $scope) {
		that.renderAll($scope, that.bean(beanN));
		$scope.find("input[data-value]").each(function () {
			if ($(this).attr("tw")) return;
			var data_value = that.replaceAll($(this).attr('data-value'), '$model.', '');
			$(this).attr("tw", "ok");
			$(this).attr("oninput", ";japp.bean('" + beanN + "')." + data_value + "=$(this).val();japp.eventS=$(this);japp.updateState();" + ($(this).attr("oninput") || ""));
		});
		$scope.find("select[data-value]").each(function () {
			if ($(this).attr("tw")) return;
			var data_value = that.replaceAll($(this).attr('data-value'), '$model.', '');
			$(this).attr("tw", "ok");
			$(this).attr("onchange", "japp.bean('" + beanN + "')." + data_value + "=$(this).val();japp.eventS=$(this);japp.updateState();" + ($(this).attr("onchange") || ""));
		});
	}
	function heartBeat(allKeys) {
		if (!runCompleted) return;
		if (allKeys == undefined) allKeys = allUsedKeys;
		var nextIterOpen = false;
		$.each(allKeys, function (key, list) {
			if (list != null)
				for (i = 0; i < list.length; i++) {
					var outkey = list[i];
					var cache = modelValCache[key + '.' + outkey];
					var val = getValFromKey(outkey, that.bean(key));
					if (cache == null || cache != val) {
						that.update(key + "." + list[i]);
						(modelValCache[key + '.' + outkey] = val);
						var coordinated = coordinatedModels[key + "." + list[i]] || null;
						if (coordinated != null) {
							var bean = that.bean(coordinated.split(".")[0]);
							var keyA = that.replaceAll(coordinated.split(".")[1], '$model', "");
							var keyB = that.replaceAll(list[i], '$model.', "");
							eval("that.beans['" + bean.name + "']." + keyA + "=that.beans['" + key + "']." + keyB + "");
							keyA = null; keyB = null;
							nextIterOpen = true;
						}
					}
				}
		});
		if (nextIterOpen) {
			heartBeat();
		}
	}
	function getUpdatedData(model) {
		var bean = that.bean(model.split(".")[0]);
		var outKey = model.substring(model.split(".")[0].length + 1, model.length);
		return getValFromKey(outKey, bean);
	}
	var updateOuts = function (newText, model) {
		var idList = key_idlist_out[model] || []; // $("span#*[data-outkey='" + model + "']");
		var doc = document;
		$.each(idList, function (i, item) {
			var elem = doc.querySelector('span#' + item);
			if (elem != null)
				elem.innerHTML = newText;
		});
	}
	var updateMiscs = function (newData, model) {
		var miscList = id_misc_model_map[model];
		if (miscList == null) return;
		$.each(miscList, function (i, mco) { //mco is like {data_misc:'',id:''}
			if (that.eventS == null) {
				$("*[data-id='" + mco.id + "']").each(function () {
					//console.log(this);
					this.setAttribute(mco.data_misc, newData);
					if (this.tagName == "SELECT" && mco.data_misc == "value") {
						console.log("val");
						$(this).val(newData);
					}
				});
			} else if (that.eventS.attr('data-id') != mco.id) {
				$("*[data-id='" + mco.id + "']").each(function () {
					//console.log(this);
					if (this.tagName == "SELECT" && mco.data_misc == "value") {
						console.log("val");
						$(this).val(newData);
					}
					this.setAttribute(mco.data_misc, newData);
				});
			}
		});
	}
	this.update = function (model) { // model is like index.test
		runCompleted = false;
		var newData = getUpdatedData(model);
		updateRepeats(newData, model);
		updateOuts(newData, model);
		updateMiscs(newData, model);
		runCompleted = true;
	}
	var __prp = function () {
		this.construct = function (bean) {
			this.bean = bean;
		}
		this.set = function (name, value) {
			this.bean[name] = value;
			//burada bÃ¼tÃ¼n bean'leri deÄŸil sadece bizim bean'i update etmek lazÄ±m
			tempObj = {};
			tempObj[this.bean.name] = allUsedKeys[this.bean.name];
			heartBeat(tempObj);
			tempObj = null;
		}
		this.get = function (name) {
			return this.bean[name];
		}
	}
	this.bean = function (name, fnc) {
		if (this.beans[name] == null) {
			var $model = new __prp();
			this.beans[name] = new (fnc)($model);
			this.beans[name].name = name;
			$model.construct(this.beans[name]);
		}
		return this.beans[name];
	}
	function clearMap(map, beanN) {
		for (var key in map) {
			if (key.split(".")[0] == beanN) {
				delete map[key];
			}
		}
	}
	//unregisters all the beans in the given html scope	
	this.clean = function ($obj) {
		var beanScopes = $obj.find("*[data-bean]");
		$.each(beanScopes, function (i, scopeElem) {
			$elem = $(scopeElem);
			var beanN = $elem.attr('data-bean');
			clearMap(key_idlist_out, beanN);
			clearMap(id_misc_model_map, beanN);
			delete allUsedKeys[beanN];
			if (that.beans[beanN].isComponentBean) delete that.beans[beanN];
		});
	}
	function normalizeKey(outKey) {
		outKey = that.replaceAll(outKey, '&gt;', '>');
		outKey = that.replaceAll(outKey, '&lt;', '<');
		outKey = that.replaceAll(outKey, '&amp;', '&');
		return outKey;
	}
	function normalizeMiscKey(miscKey) {
		if (miscKey.indexOf("{{") != -1) {//Ã¶zel expression yazÄ±lmÄ±ÅŸsa
			miscKey = that.replaceAll(miscKey, "{{", "'+(");
			miscKey = "'" + that.replaceAll(miscKey, "}}", ")+'") + "'";
		}
		return miscKey;
	}
	this.replaceAll = function (target, search, replacement) {
		return target.split(search).join(replacement);
	};
});
