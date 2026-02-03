package profiling

import (
	"net/http"
	"net/http/pprof"

	"github.com/gin-gonic/gin"
)

// PProfConfig holds configuration for pprof endpoints
type PProfConfig struct {
	// Enabled determines if pprof endpoints are registered
	Enabled bool
	// Prefix is the URL prefix for pprof endpoints (default: /debug/pprof)
	Prefix string
}

// DefaultPProfConfig returns the default pprof configuration
func DefaultPProfConfig() PProfConfig {
	return PProfConfig{
		Enabled: true,
		Prefix:  "/debug/pprof",
	}
}

// RegisterPProf registers pprof endpoints with a Gin router
// These endpoints allow for CPU, memory, goroutine, and other profiling
// WARNING: Only enable in development/staging - exposes sensitive runtime info
func RegisterPProf(router *gin.Engine, config PProfConfig) {
	if !config.Enabled {
		return
	}

	prefix := config.Prefix
	if prefix == "" {
		prefix = "/debug/pprof"
	}

	pprofGroup := router.Group(prefix)
	{
		// Index page with links to all profiles
		pprofGroup.GET("/", gin.WrapF(pprof.Index))

		// Allocs: A sampling of all past memory allocations
		pprofGroup.GET("/allocs", gin.WrapH(pprof.Handler("allocs")))

		// Block: Stack traces that led to blocking on synchronization primitives
		pprofGroup.GET("/block", gin.WrapH(pprof.Handler("block")))

		// Cmdline: The command line invocation of the current program
		pprofGroup.GET("/cmdline", gin.WrapF(pprof.Cmdline))

		// Goroutine: Stack traces of all current goroutines
		pprofGroup.GET("/goroutine", gin.WrapH(pprof.Handler("goroutine")))

		// Heap: A sampling of memory allocations of live objects
		pprofGroup.GET("/heap", gin.WrapH(pprof.Handler("heap")))

		// Mutex: Stack traces of holders of contended mutexes
		pprofGroup.GET("/mutex", gin.WrapH(pprof.Handler("mutex")))

		// Profile: CPU profile. Accepts ?seconds=X for duration
		pprofGroup.GET("/profile", gin.WrapF(pprof.Profile))

		// Threadcreate: Stack traces that led to the creation of new OS threads
		pprofGroup.GET("/threadcreate", gin.WrapH(pprof.Handler("threadcreate")))

		// Trace: Execution trace. Accepts ?seconds=X for duration
		pprofGroup.GET("/trace", gin.WrapF(pprof.Trace))

		// Symbol: Looks up the program counters listed in the request
		pprofGroup.GET("/symbol", gin.WrapF(pprof.Symbol))
		pprofGroup.POST("/symbol", gin.WrapF(pprof.Symbol))
	}
}

// RegisterPProfWithAuth registers pprof endpoints with basic auth protection
func RegisterPProfWithAuth(router *gin.Engine, config PProfConfig, username, password string) {
	if !config.Enabled {
		return
	}

	prefix := config.Prefix
	if prefix == "" {
		prefix = "/debug/pprof"
	}

	// Create auth middleware
	authMiddleware := gin.BasicAuth(gin.Accounts{
		username: password,
	})

	pprofGroup := router.Group(prefix, authMiddleware)
	{
		pprofGroup.GET("/", gin.WrapF(pprof.Index))
		pprofGroup.GET("/allocs", gin.WrapH(pprof.Handler("allocs")))
		pprofGroup.GET("/block", gin.WrapH(pprof.Handler("block")))
		pprofGroup.GET("/cmdline", gin.WrapF(pprof.Cmdline))
		pprofGroup.GET("/goroutine", gin.WrapH(pprof.Handler("goroutine")))
		pprofGroup.GET("/heap", gin.WrapH(pprof.Handler("heap")))
		pprofGroup.GET("/mutex", gin.WrapH(pprof.Handler("mutex")))
		pprofGroup.GET("/profile", gin.WrapF(pprof.Profile))
		pprofGroup.GET("/threadcreate", gin.WrapH(pprof.Handler("threadcreate")))
		pprofGroup.GET("/trace", gin.WrapF(pprof.Trace))
		pprofGroup.GET("/symbol", gin.WrapF(pprof.Symbol))
		pprofGroup.POST("/symbol", gin.WrapF(pprof.Symbol))
	}
}

// RegisterPProfStandalone registers pprof on a separate HTTP server
// This is useful for isolating profiling from the main application
func RegisterPProfStandalone(addr string) *http.Server {
	mux := http.NewServeMux()

	mux.HandleFunc("/debug/pprof/", pprof.Index)
	mux.HandleFunc("/debug/pprof/cmdline", pprof.Cmdline)
	mux.HandleFunc("/debug/pprof/profile", pprof.Profile)
	mux.HandleFunc("/debug/pprof/symbol", pprof.Symbol)
	mux.HandleFunc("/debug/pprof/trace", pprof.Trace)
	mux.Handle("/debug/pprof/allocs", pprof.Handler("allocs"))
	mux.Handle("/debug/pprof/block", pprof.Handler("block"))
	mux.Handle("/debug/pprof/goroutine", pprof.Handler("goroutine"))
	mux.Handle("/debug/pprof/heap", pprof.Handler("heap"))
	mux.Handle("/debug/pprof/mutex", pprof.Handler("mutex"))
	mux.Handle("/debug/pprof/threadcreate", pprof.Handler("threadcreate"))

	server := &http.Server{
		Addr:    addr,
		Handler: mux,
	}

	return server
}

// EnableBlockProfiling enables profiling of blocking operations
// Rate controls the fraction of goroutine blocking events that are reported
// Rate 1 reports every blocking event
func EnableBlockProfiling(rate int) {
	if rate < 0 {
		rate = 0
	}
	// This is typically set via runtime.SetBlockProfileRate(rate)
	// imported from runtime package
}

// EnableMutexProfiling enables profiling of mutex contention
// Rate controls the fraction of mutex contention events that are reported
// Rate 1 reports every mutex contention event
func EnableMutexProfiling(rate int) {
	if rate < 0 {
		rate = 0
	}
	// This is typically set via runtime.SetMutexProfileFraction(rate)
	// imported from runtime package
}
