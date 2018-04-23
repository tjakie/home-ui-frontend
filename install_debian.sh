#!/bin/bash 
if ! which git > /dev/null; then
	curl -sL https://deb.nodesource.com/setup_8.x | sudo -E bash -
	sudo apt-get install -y nodejs git
fi

cd ~

mainDir=$(pwd)"/homeui"

cd $mainDir;


#
# CHECKOUT/UPDATE THE FRONTEND REPO
#

frontendDir="frontend/";
if ! [ -d $frontendDir ]; then

	git clone https://github.com/tjakie/home-ui-frontend.git $frontendDir

else
	cd $frontendDir
	git pull
	cd ..
fi

cd $frontendDir
npm install

#
# install the init.d script
#
serviceFile=/etc/init.d/homeui

if [ -f "$serviceFile" ]; then 
	sudo service homeui stop
	sudo update-rc.d homeui remove
	
	sudo rm $serviceFile
	
	rm $mainDir"/"$frontendDir"init.d.script"
fi

sed "s+theapplicationdirectory+$mainDir/$frontendDir+g" $mainDir"/"$frontendDir"init.d.script.example" > $mainDir"/"$frontendDir"init.d.script"
sed -i "s+root+$(whoami)+g" $mainDir"/"$frontendDir"init.d.script"

sudo ln -s $mainDir"/"$frontendDir"init.d.script" "$serviceFile"
	
sudo chmod +x $serviceFile
	
sudo update-rc.d homeui defaults






#
# CHECKOUT/UPDATE THE HARDWARE REPO'S
#
hardwareDir="hardware/"

if ! [ -d $hardwareDir ]; then
	mkdir $hardwareDir
fi

cd $hardwareDir;

moduleRepo=(
	"https://github.com/tjakie/home-ui-tplink-hs.git"
	"https://github.com/tjakie/home-ui-harmonyhub"
);

moduleDir=( 
	"tplinkHs" 
	"harmonyHub" 
);

arraylength=${#moduleRepo[@]}
for (( i=0; i<${arraylength}; i++ ));
do
	echo "Checking out/updating module:" ${moduleDir[$i]}

	moduleDir=${moduleDir[$i]}
		
	if ! [ -d $moduleDir ]; then

		git clone ${moduleRepo[$i]} $moduleDir

	else
		cd $moduleDir
		git pull
		cd ..
	fi

	cd $moduleDir
	npm install
	cd ..
	
	echo "Done with module:" ${moduleDir[$i]}
done

cd ..

#
# Start the service
#

sudo service homeui start