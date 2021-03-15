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
    this.initComponents(_Vue);
    this.initEvent();
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
  initEvent(){
    window.addEventListener('popstate', ()=>{
        this.data.current = window.location.pathname
    })
}
}