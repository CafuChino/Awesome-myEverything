# 手动实现vue-router

所需的前置知识：
- 插件
- 混入
- Vue.observable()
- 插槽
- render函数
- 运行时和完整版的Vue

## 实现原理

Vue Router是前端路由，当路径切换时在浏览器判断当前路径，并加载对应组件

### Hash模式

- URL中#（HashTAG）后面的内容是路径地址
- 监听`hashchange`事件
- 根据当前路由地址找到对应组件并重新渲染

### History 模式

- 通过history.pushState()方法改变地址栏（这一操作只改变地址栏并记录历史，并不真正跳转）
- 监听`popstate`事件
- 根据当前路由地址找到对应组件并重新渲染

## 回顾核心代码

``` javascript
// router/index.js
// 注册插件
Vue.use(VueRouter)
// 创建路由对象
const router = new VueRouter({
  routes: [
    { name: 'home', path: '/', component: homeComponent }
  ]
})

// main.js
// 创建Vue示例， 注册router对象
new Vue({
  router,
  render: h =>h(App)
}).$mount('#app')
```
类图：

![类图](https://i.loli.net/2021/03/15/sjAMpoH5KBq8aOg.png)

接下来要实现的就是这个**VueRouter**类

**属性：**

1. **options：**记录构造函数中传入的对象
2. **data:{current}**：需要一个响应式的对象，以便地址变化的时候路由可以响应式的更新
3. **routeMap：**用于记录路由地址和组件的对应关系，会将路由规则解析到routeMap上

**方法：**

1. **Constructor(Options):VueRouter**:构造函数
2. **_install(Vue):void**:用于实现Vue的插件机制
3. **init():void**:用于调用其他方法
4. **initEvent():void**:用于注册popstate事件
5. **createRouteMap():void**:初始化routeMap对象，建立路由组建关系
6. **initComponents(Vue):void**：用于创建<router-view>，<router-link>组件

## 手写实现

### install方法

install方法是Vue插件机制的关键，在vue插件系统的官方文档中讲述了插件的开发方法，其实主要的部分就是install方法需要做的事情。在这里引用一部分内容：

>:notebook_with_decorative_cover:[官方文档](https://cn.vuejs.org/v2/guide/plugins.html#%E5%BC%80%E5%8F%91%E6%8F%92%E4%BB%B6)
>
>Vue.js 的插件应该暴露一个 `install` 方法。这个方法的第一个参数是 `Vue` 构造器，第二个参数是一个可选的选项对象：
>
>```javascript
>MyPlugin.install = function (Vue, options) {
>  // 1. 添加全局方法或 property
>  Vue.myGlobalMethod = function () {
>    // 逻辑...
>  }
>
>  // 2. 添加全局资源
>  Vue.directive('my-directive', {
>    bind (el, binding, vnode, oldVnode) {
>      // 逻辑...
>    }
>    ...
>  })
>
>  // 3. 注入组件选项
>  Vue.mixin({
>    created: function () {
>      // 逻辑...
>    }
>    ...
>  })
>
>  // 4. 添加实例方法
>  Vue.prototype.$myMethod = function (methodOptions) {
>    // 逻辑...
>  }
>}
>```

整理一下我们的手写实现思路：

1. 判断当前插件是否已经被安装（Vue的插件只能安装一次）
2. 添加全局资源
3. 注入组件选项
4. 添加实例方法

#### 判断安装状态

显然我们需要一个变量来记录插件是否被安装了，局部变量显然无法记录状态；全局变量会引入外部依赖，显然也不妥，所以鉴于install方法是一个静态方法，其上可以带一个属性。这个属性会长期保持，并可随时访问，很适合这种需求，所以我们只需要：

``` javascript
export default class VueRouter{
  /**
   * Vue.use的时候调用的函数，传入Vue的构造实例， 和可选的选项
   * @param {*} Vue Vue的构造实例
   * @param {*} options 选项对象（可选）
   */
  static install(Vue, options){
    // 1.判断当前插件是否已经被安装
    if (VueRouter.install.installed) return;
    VueRouter.install.installed = true;
    // 2.把Vue构造函数记录到全局变量
    // 3.把创建Vue实例时候传入的router对象注入到Vue实例上
  }
}
```

#### 注入组件选项

虽然在use的时候已经传入了Vue的构造实例了，但是我们不能通过prototype直接在所有的Vue实例上挂载实例方法。原因是install是静态方法，调用的时候其this指向的是VueRouter类，而不是Vue实例。所以此处必须使用`Vue.mixin()`来进行注入，这样每一个Vue实例在指定的生命周期钩子被触发的时候都会执行混入的内容，从而达到在每一个Vue实例上注入的效果：

``` javascript
let _Vue;
export default class VueRouter {
  /**
   * Vue.use的时候调用的函数，传入Vue的构造实例， 和可选的选项
   * @param {*} Vue Vue的构造实例
   * @param {*} options 选项对象（可选）
   */
  static install(Vue, options) {
    // 1.判断当前插件是否已经被安装
    if (VueRouter.install.installed) return;
    VueRouter.install.installed = true;
    // 2.把Vue构造函数记录到全局变量(组件内全局，以方便以下逻辑调用)
    _Vue = Vue
    // 3.把创建Vue实例时候传入的router对象注入到Vue实例上
    _Vue.mixin({
      beforeCreate() {
        // 只需要给vue实例挂载，而不需要给组件挂载，组件是没有$options的
        if (this.$options.router) {
          // 此时this的指向就不再是VueRouter了，而是实例本身了
          _Vue.prototype.$router = this.$options.router
        }
      }
    })
  }
}
```

### 构造函数

构造函数只需要初始化三个属性，并且将data设为响应式，Vue为我们提供了`Vue.observable()`方法，可以直接将其转化为响应式的对象，所以构造函数我们可以如下实现：

``` javascript
constructor(options) {
    this.options = options;
    this.routerMap = {};
    this.data = _Vue.observable({
      // 当前地址，默认为根
      current: '/'
    })
  }
```

### createRouteMap方法

这一方法可以将Options中传入的路由规则转化为路由键值对的形式，键是路由的地址，值是对应的组件。这样路由变化时，就可以快速的找到对应的组件并将其渲染出来。

``` javascript
  createRouteMap(){
    // 遍历所有的路由规则解析并构造键值对
    this.options.routes.forEach(route => {
      this.routeMap[route.path] = route.component
    });
  }
```

### initComponents方法和init方法

顾名思义，这个函数用于初始化跟路由相关的两个组件：<router-link>，<router-view>。<router-link>组件接受一个字符串类型的参数`to`并且标签中的内容会被渲染成a标签。与此同时我们还可以使用init方法将之前的`createRouteMap`和这一方法包装一下，方便统一调用。

至此完整代码如下

``` javascript
let _Vue;
export default class VueRouter {
  /**
   * Vue.use的时候调用的函数，传入Vue的构造实例， 和可选的选项
   * @param {*} Vue Vue的构造实例
   * @param {*} options 选项对象（可选）
   */
  
// eslint-disable-next-line no-unused-vars
  static install(Vue, options) {
    // 1.判断当前插件是否已经被安装
    if (VueRouter.install.installed) return;
    VueRouter.install.installed = true;
    // 2.把Vue构造函数记录到全局变量(组件内全局，以方便以下逻辑调用)
    _Vue = Vue
    // 3.把创建Vue实例时候传入的router对象注入到Vue实例上
    _Vue.mixin({
      beforeCreate() {
        // 只需要给vue实例挂载，而不需要给组件挂载，组件是没有$options的
        if (this.$options.router) {
          // 此时this的指向就不再是VueRouter了，而是实例本身了
          _Vue.prototype.$router = this.$options.router
          this.$options.router.init()
        }
      }
    })
  }
  constructor(options) {
    this.options = options;
    this.routeMap = {};
    this.data = _Vue.observable({
      // 当前地址，默认为根
      current: '/'
    })
  }
  init(){
    this.createRouteMap();
    this.initComponents(_Vue)
  }
  createRouteMap(){
    // 遍历所有的路由规则解析并构造键值对
    this.options.routes.forEach(route => {
      this.routeMap[route.path] = route.component
    });
  }
  initComponents(Vue){
    Vue.component('router-link', {
      props:{
        to: String,
      },
      template:'<a :href="to"><slot></slot></a>'
    })
  }
}
```

到这一步，路由就可以正常跳转了（虽然还不能显示），其实核心工作就是进行了一步解析，一步混入挂载，一步声明router-link（实际上就是个a标签）。如果你熟悉vue的源码或原理，对render中的h函数必然不会感到陌生了。但是其实这个时候的跳转不是我们想要的跳转，我们想要的跳转并不是真正的跳转，而是只改变地址栏和渲染的组件，所以我们必须进一步阻止a标签的默认行为，并调用`pushState`api来改变地址栏：

``` javascript
initComponents(Vue) {
    Vue.component('router-link', {
      props: {
        to: String,
      },
      render(h) {
        return h('a', {
          attrs: {
            href: this.to
          },
          on: {
            click: this.clickHandler
          }
        }, [this.$slots.default])
      },
      methods: {
        clickHandler(e) {
          history.pushState({}, '', this.to);
          this.$router.data.current = this.to
          e.preventDefault()
        }
      }
    })
  }
```

经过一番修改，我们成功的阻止了默认行为，并且通过api改变了地址栏内容，修改了current响应式参数的值。不过这个时候组件还不能被渲染，因为我们还没有声明`router-view`组件。render函数也可以直接帮助我们渲染一个组件。既然current是响应式的，当current发生变化的时候，渲染的内容自然而然的就会发生变化了。唯一的问题在于，在render函数中，this的指向是指向该实例内部的this而不是VueRouter对象的，所以我们不可以在这里直接使用this。带有`router-view`组件的完整代码如下：

``` javascript
let _Vue;
export default class VueRouter {
  /**
   * Vue.use的时候调用的函数，传入Vue的构造实例， 和可选的选项
   * @param {*} Vue Vue的构造实例
   * @param {*} options 选项对象（可选）
   */

  // eslint-disable-next-line no-unused-vars
  static install(Vue, options) {
    // 1.判断当前插件是否已经被安装
    if (VueRouter.install.installed) return;
    VueRouter.install.installed = true;
    // 2.把Vue构造函数记录到全局变量(组件内全局，以方便以下逻辑调用)
    _Vue = Vue
    // 3.把创建Vue实例时候传入的router对象注入到Vue实例上
    _Vue.mixin({
      beforeCreate() {
        // 只需要给vue实例挂载，而不需要给组件挂载，组件是没有$options的
        if (this.$options.router) {
          // 此时this的指向就不再是VueRouter了，而是实例本身了
          _Vue.prototype.$router = this.$options.router
          this.$options.router.init()
        }
      }
    })
  }
  constructor(options) {
    this.options = options;
    this.routeMap = {};
    this.data = _Vue.observable({
      // 当前地址，默认为根
      current: '/'
    })
  }
  init() {
    this.createRouteMap();
    this.initComponents(_Vue)
  }
  createRouteMap() {
    // 遍历所有的路由规则解析并构造键值对
    this.options.routes.forEach(route => {
      this.routeMap[route.path] = route.component
    });
  }
  initComponents(Vue) {
    Vue.component('router-link', {
      props: {
        to: String,
      },
      render(h) {
        return h('a', {
          attrs: {
            href: this.to
          },
          on: {
            click: this.clickHandler
          }
        }, [this.$slots.default])
      },
      methods: {
        clickHandler(e) {
          history.pushState({}, '', this.to);
          this.$router.data.current = this.to
          e.preventDefault()
        }
      }
    })
    const self = this;
    Vue.component('router-view', {
      render(h){
        const component = self.routeMap[self.data.current];
        return h(component)
      }
    })
  }
}
```

现在我们就完美的实现了所有功能。除了最后一个问题——**当我们点击浏览器后退时会怎么样**，当然什么都不会发生。因为地址栏虽然发生了变化，但是current没有发生变化，current没有发生变化组件就不会变化，所以什么都不会发生，而如果我们希望组件也变化，那么便需要监听popstate事件。

### initEvent方法

这一部分很简单，我们只需要添加一个全局的popstate的事件监听，并将地址赋值给current即可：

``` javascript
initEvent(){
    window.addEventListener('popstate', ()=>{
        this.data.current = window.location.pathname
    })
}
```

当然，不要忘记在`init()`函数中调用一下这个初始化函数，这样我们才算是真正的自己实现了vue-router。