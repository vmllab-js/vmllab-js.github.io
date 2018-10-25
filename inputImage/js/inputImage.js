/**
 * 移动端上传图片工具, 包括微信和非微信情况
 * @author yinghao.liu
 * @version 1.1.1025
 */

(function (root, factory) {
	if (typeof define === 'function' && (define.amd || define.cmd)) {
		define("inputImage", ["EXIF"], factory);
	} else {
		root.inputImage = factory(EXIF);
	}
}(this, function (EXIF) {
	"use strict";

	var inputImage = {
		lastInput: null,
		/**
		 * 上传图片/拍照
		 * @param-config camera {Boolean} false 只拍照
		 * @param-config multiple {Boolean} false 多选图片
		 * @param-config format {String} "image" 返回的图片类型:file/base64/image
		 * @param-config success {Function}
		 * @param-config fail {Function}
		 */
		input: function (param) {
			var input = document.createElement('input');
			input.type = 'file';
			input.accept = 'image/*';
			if (param.camera) input.capture = 'camera';
			if (param.multiple) input.multiple = 'multiple';

			input.style.display = 'none';
			document.body.appendChild(input);
			if (this.lastInput) this.lastInput.remove();
			this.lastInput = input;

			input.onchange = function () {
				if (param.success) {
					switch (param.format) {
						case 'file':
							param.success(this.files);
							break;
						case 'base64':
							inputImage.convertFilesToBase64(this.files, function (files) {
								param.success(files);
							});
							break;
						case 'image':
						default:
							inputImage.convertFilesToImage(this.files, function (files) {
								param.success(files);
							});
							break;
					}
				}
				if (inputImage.lastInput == input) {
					input.remove();
					inputImage.lastInput = null;
				}
			};
			input.onerror = function (err) {
				if (param.fail) param.fail(err);
			};
			input.click();
		},
		/**
		 * 等比缩放图片
		 * @param-config image {Image} Image格式图片
		 * @param-config base64 {String} base64格式图片
		 * @param-config file {File} File格式图片
		 * @param-config width {Number} 新尺寸宽
		 * @param-config height {Number} 新尺寸高
		 * @param-config max {Number} 新尺寸最大值
		 * @param-config min {Number} 新尺寸最小值
		 * @param-config type {String} 返回base64格式图片的类型，默认为image/png
		 * @param-config quality {float} 在指定图片格式为 image/jpeg 或 image/webp的情况下，可以从 0 到 1 的区间内选择图片的质量。如果超出取值范围，将会使用默认值 0.92。其他参数会被忽略。
		 * @param-config success {Function} 返回base64格式新尺寸图片和宽高
		 * @param-config fail {Function}
		 */
		resize: function (param) {
			if (param.image) {
				if (param.image.complete) {
					__gotImage(param.image);
				} else {
					param.image.addEventListener('load', function () {
						__gotImage(this);
					});
				}
			}
			else if (param.file) param.image = inputImage.convertFileToImage(param.file, __gotImage);
			else if (param.base64) param.image = inputImage.convertBase64ToImage(param.base64, __gotImage);

			function __gotImage(img) {
				// 需要判断下是否需要旋转
				EXIF.getData(img, function () {
					var orientation = EXIF.getTag(this, "Orientation");
					img = __rotate(img, orientation);

					var W = img.width, H = img.height;
					var ratio = W / H;
					var width = param.width || (ratio > 1 ? param.max : param.min);
					var height = param.height || (ratio > 1 ? param.min : param.max);
					if (width) {
						height = Math.round(width / ratio);
					} else if (height) {
						width = Math.round(height * ratio);
					} else {
						width = W;
						height = H;
					}

					var canvas = document.createElement('canvas');
					canvas.width = width;
					canvas.height = height;
					var context = canvas.getContext('2d');
					context.drawImage(img, 0, 0, W, H, 0, 0, width, height);
					param.success(canvas.toDataURL(param.type || 'image/png', param.quality), width, height);
				});
			}

			function __rotate(img, orientation) {
				var canvas = document.createElement("canvas");
				var context = canvas.getContext("2d");
				var W = img.naturalWidth, H = img.naturalHeight;
				switch (orientation) {
					case 6: //需要顺时针（向左）90度旋转
						canvas.width = H;
						canvas.height = W;
						context.rotate(Math.PI / 2);
						context.drawImage(img, 0, -canvas.width);
						break;
					case 8: //需要逆时针（向右）90度旋转
						canvas.width = H;
						canvas.height = W;
						context.rotate(Math.PI / 2 * 3);
						context.drawImage(img, -canvas.height, 0);
						break;
					case 3: //需要180度旋转
						canvas.width = W;
						canvas.height = H;
						context.rotate(Math.PI / 2 * 2);
						context.drawImage(img, -canvas.height, -canvas.width);
						break;
					default:
						canvas.width = W;
						canvas.height = H;
						context.drawImage(img, 0, 0);
						break;
				}
				return canvas;
			}
		},
		/**
		 * 校正照片旋转度
		 * @param-config image {Image} Image格式图片
		 * @param-config base64 {String} base64格式图片
		 * @param-config file {File} File格式图片
		 * @param-config type {String} 返回base64格式图片的类型，默认为image/png
		 * @param-config quality {float} 在指定图片格式为 image/jpeg 或 image/webp的情况下，可以从 0 到 1 的区间内选择图片的质量。如果超出取值范围，将会使用默认值 0.92。其他参数会被忽略。
		 * @param-config success {Function} 返回base64格式图片
		 * @param-config fail {Function}
		 */
		adjust: function (param) {
			inputImage.resize(param);
		},
		/**
		 * 转换File图片成base64格式
		 * @param file {File}
		 * @param success {Function}
		 * @param fail {Function}
		 */
		convertFileToBase64: function (file, success, fail) {
			var reader = new FileReader();
			reader.onload = function () {
				success(this.result);
			};
			reader.onerror = fail;
			reader.readAsDataURL(file);
		},
		/**
		 * 转换多个File图片成base64格式
		 * @param files {File[]}
		 * @param success {Function}
		 * @param fail {Function}
		 */
		convertFilesToBase64: function (files, success, fail) {
			var arr = [], len = files.length, count = 0;
			for (var i = 0; i < len; ++i) {
				inputImage.convertFileToBase64(files[i], function (base64) {
					arr.push(base64);
					if (++count == len) success(arr);
				}, function () {
					if (++count == len) success(arr);
				});
			}
		},
		/**
		 * 转换File图片成Image格式
		 * @param file {File}
		 * @param success {Function}
		 * @param fail {Function}
		 */
		convertFileToImage: function (file, success, fail) {
			var img = new Image();
			img.onload = function () {
				success(img);
			};
			img.onerror = fail;

			var url = null;
			if (window.createObjectURL) {
				url = window.createObjectURL(file);
			} else if (window.URL) {
				url = window.URL.createObjectURL(file);
			} else if (window.webkitURL) {
				url = window.webkitURL.createObjectURL(file);
			} else {
				if (fail) fail();
			}
			img.src = url;
		},
		/**
		 * 转换多个File图片成Image格式
		 * @param files {File[]}
		 * @param success {Function}
		 * @param fail {Function}
		 */
		convertFilesToImage: function (files, success, fail) {
			var arr = [], len = files.length, count = 0;
			for (var i = 0; i < len; ++i) {
				inputImage.convertFileToImage(files[i], function (img) {
					arr.push(img);
					if (++count == len) success(arr);
				}, function () {
					if (++count == len) success(arr);
				});
			}
		},
		/**
		 * 转换base64图片成Image格式
		 * @param base64 {String}
		 * @param success {Function}
		 * @param fail {Function}
		 */
		convertBase64ToImage: function (base64, success, fail) {
			var img = new Image();
			img.onload = function () {
				success(img);
			};
			img.onerror = fail;
			img.src = base64;
		}
	};

	return inputImage;
}));