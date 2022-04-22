const cloud = require('wx-server-sdk')
const axios = require('axios');
const lodash = require('lodash');
const schedule = require('node-schedule');

cloud.init({
	secretId: 'AKIDCE0VjgMlvoPjmZ5KJ1SdW9VZMs75mCLD',
	secretKey: 'dz5uSjiRusZz7yYrte8KGuHNCk12oJXU',
    env:'cloud1-8gszwl1o8a144133'
})


const db = cloud.database()


const videos = db.collection('videos-test')
const history = db.collection('history-test')
const upper = db.collection('upper')


const _ = db.command
const $ = db.command.aggregate



async function removeUpperAndVideo(){
	var res = await upper.aggregate().match({})
		.group({
	      _id:'$tempTag',
	      allData: $.push('$$ROOT')
		})
		.end()
		
	var list = res.list[0].allData
	
	
	for(var item of list){
		if(item.user.length == 0){
    		await history.where({mid: item.mid}).remove()
    		await upper.where({mid: item.mid}).remove()
		}
	}
		
}
async function getUppers(){
	var max = 100
	var result = await db.collection('upper').count()
	var total = result.total 
	// 计算需分几次取
	var batchTimes = Math.ceil(total / max)
	
	if(total <= 0) return;
	
	var tasks = []
	
	for(var i = 0; i < batchTimes; i++){
		var promise  = await db.collection('upper').skip(i*max).limit(max).get()
		tasks.push(promise)	
	}
	//分批次读取 upper
	var totalUpper = (await Promise.all(tasks)).reduce((acc,cur)=>{
			return acc.concat(cur.data)
	}, [])
	
	//只返回有人关注的up主
	var filterUpper = totalUpper.filter((item,i)=>{
		return item.user.length > 0
	})
	console.log(filterUpper);
	return filterUpper
}

async function getVideos(){
	var max = 100
	var result = await videos.count()
	var total = result.total 
	// 计算需分几次取
	var batchTimes = Math.ceil(total / max)
	
	if(total <= 0) return;
	
	var tasks = []
	
	for(var i = 0; i < batchTimes; i++){
		var promise  = await videos.skip(i*max).limit(max).get()
		tasks.push(promise)	
	}
	//分批次读取 upper
	var totalVideo = (await Promise.all(tasks)).reduce((acc,cur)=>{
		return acc.concat(cur.data)
	}, [])
	
	
	
	
	return totalVideo
}

//插入视频列表
async function insertVideoInfo(){
	var totalUpper = await getUppers();
	var promise = [];
	for (var upper of totalUpper) {
        await sleep(1000);
		var totalData = await getUpperVideoList(upper.mid)
		var filterResultObj = filterData(totalData)
		
		//得到每个up的所有视频列表
		var videoMainInfoList = filterResultObj.videoMainInfo 
		
		for(var video of videoMainInfoList){
			await insertVideo(video)
		}
		console.log('over');
	}


}
async function insertVideoStatistics(){
	var totalVideos = await getVideos()
	var promise = [];
	
	var currentDate = new Date().toISOString().split("T")[0]
	
	for (var item of totalVideos) {
		
        await sleep(1000);
		var videoInDatabase = await history.where({bvid: item.bvid, date:currentDate }).get()
		var videoInDatabaseItem = videoInDatabase.data;
	
		console.log('videoInDatabaseItem',videoInDatabaseItem);
    	var newData = {}
    	var result = await axios.get(`http://api.bilibili.com/x/web-interface/archive/stat?aid=${item.aid}`)
    	
    	if( result.data.data){
			var data = result.data.data;
			//插入视频信息
			newData.aid = data.aid;
			newData.bvid = data.bvid;
			newData.view = data.view;
			newData.danmaku = data.danmaku;
			newData.favorite = data.favorite;
			newData.coin = data.coin;
			newData.like = data.like;
			newData.reply = data.reply;
			newData.mid = item.mid;
	    	newData.date = currentDate
	    	newData.addDate = new Date()
	    	

	    	
	    	
	    	if(videoInDatabaseItem.length > 0){
	    		await history.doc(videoInDatabaseItem[0]._id).update({
	    			data: newData
	    		})
	    	}else{
	    		history.add({
	    			data: newData
	    		}).then(res => {
	    		  console.log(res)
	    		}).catch(console.error)
	    	}
	    	
	    	//历史数据库
	    	
			
			
    	}else if(data == null){
    		await videos.where({aid: item.aid}).remove()
    	}
	}
		
	
	
}
// getVideo()



async function getUpperVideoList(mid){
	var result = await axios.get(`https://api.bilibili.com/x/space/arc/search?mid=${mid}&pn=1&ps=1`)
	var max = 30
	var total = result.data.data.page.count 
	// 默认第一页
	var pageNum = 1
	// 计算需分几次取
	var batchTimes = Math.ceil(total / max)
	
	if(total > 0){
		var tasks = []
		var totalData = []
		
		for(var i = 1; i <= batchTimes; i++){
			var promise = fetchList(mid, i, max)	
			tasks.push(promise)	
		}
		if(tasks.length > 0){
			totalData = await getAllTaskResult(tasks) //此up主所有视频
			return totalData;
		}		
	}
}

function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}


async function getAllTaskResult(tasks){
	return (await Promise.all(tasks)).reduce((acc,cur)=>{
			return acc.concat(cur)
	}, [])
}
async function inserStatistics(data){
	history.add({
		data
	})
}

//插入视频列表
async function insertVideo(item){
	var result = await videos.where({bvid: item.bvid}).get()
	var data = result.data
	if(data.length > 0){
		//有数据 就判断是否更新
		if(data[0].title != item.title ){
			await videos.doc(data[0]._id).update({
				data: {
					title: item.title
				}
			})
		}
	}else{
		//无数据 就插入
		await videos.add({
			data: item
		})
	}
}

async function fetchList(mid,pn,ps){
	try{
		var result = await axios.get(`https://api.bilibili.com/x/space/arc/search?mid=${mid}&pn=${pn}&ps=${ps}`)
		return result.data.data.list.vlist
	} catch (error) {
		console.log(error)
	}
}

function filterData(vlist){
		// var result = await getAllList()
		// 数据位置
		// var vlist = result.data.data.list.vlist;
	    // var filterResult = _.pick(result.data.data.list.vlist, ['aid','bvid', 'author','created','title','mid']);
	    var videoMainInfo = lodash.map(vlist, lodash.partialRight(lodash.pick, ['aid', 'bvid', 'author', 'created', 'title', 'mid']));
		var videoStatistics = lodash.map(vlist, lodash.partialRight(lodash.pick, ['aid', 'bvid', 'comment', 'play', 'video_review']));
		videoStatistics.forEach(function(item){
			item.addDate = new Date()
		})
		return {
			videoMainInfo: videoMainInfo,
			videoStatistics: videoStatistics
		}
}



// 定义规则
let rule = new schedule.RecurrenceRule();
rule.second = [0, 10, 20, 30, 40, 50]; 

var date = '0 7 8 * * *'

let job = schedule.scheduleJob(rule, async () => {
	// await removeUpperAndVideo()
	// await insertVideoInfo()
	// await insertVideoStatistics()
    await sleep(4000);
	console.log('1');
});